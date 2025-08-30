const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI (only if API key is provided)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Middleware
app.use(cors());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Contract Forge Backend is running' });
});

// AI Contract Generation endpoint
app.post('/api/generate-contract', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    console.log('🤖 Generating contract for prompt:', prompt);

    // Generate Solidity contract using OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a Solidity smart contract expert. Generate a complete, production-ready Solidity smart contract based on the user's requirements. 
          
          Requirements:
          - Use Solidity ^0.8.0 or higher
          - Include proper SPDX license
          - Add comprehensive NatSpec documentation
          - Include error handling and access control where appropriate
          - Make it gas-efficient
          - Return ONLY the Solidity code, no explanations or markdown`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const solidityCode = completion.choices[0].message.content;
    
    // Generate contract explanation
    const explanationCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Explain this Solidity smart contract in simple, plain English. Focus on what the contract does, its main functions, and any important security considerations. Keep it concise and easy to understand."
        },
        {
          role: "user",
          content: solidityCode
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const explanation = explanationCompletion.choices[0].message.content;

    res.json({
      success: true,
      contract: solidityCode,
      explanation: explanation,
      prompt: prompt
    });

  } catch (error) {
    console.error('❌ Error generating contract:', error);
    res.status(500).json({ 
      error: 'Failed to generate contract',
      details: error.message 
    });
  }
});

// Contract Compilation endpoint
app.post('/api/compile-contract', async (req, res) => {
  try {
    const { contractCode, contractName = 'GeneratedContract' } = req.body;
    
    if (!contractCode) {
      return res.status(400).json({ error: 'Contract code is required' });
    }

    console.log('🔨 Compiling contract:', contractName);

    // Create temporary contract file in the contracts directory
    const contractPath = path.join(__dirname, 'contracts', `${contractName}.sol`);
    fs.writeFileSync(contractPath, contractCode);

    try {
      // Compile using Hardhat
      const compileCommand = `npx hardhat compile --force`;
      execSync(compileCommand, { 
        cwd: __dirname,
        stdio: 'pipe',
        encoding: 'utf8'
      });

      // Read compiled artifacts
      const artifactPath = path.join(__dirname, 'artifacts', 'contracts', `${contractName}.sol`, `${contractName}.json`);
      
      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        
        // Clean up temporary contract file
        if (fs.existsSync(contractPath)) {
          fs.unlinkSync(contractPath);
        }
        
        // Clean up cache
        try {
          if (fs.existsSync(path.join(__dirname, 'cache'))) {
            fs.rmSync(path.join(__dirname, 'cache'), { recursive: true, force: true });
          }
        } catch (cleanupError) {
          console.log('Cleanup warning:', cleanupError.message);
        }

        res.json({
          success: true,
          abi: artifact.abi,
          bytecode: artifact.bytecode,
          contractName: contractName
        });
      } else {
        throw new Error('Compilation artifacts not found');
      }

    } catch (compileError) {
      // Clean up on compilation failure
      if (fs.existsSync(contractPath)) {
        fs.unlinkSync(contractPath);
      }
      throw compileError;
    }

  } catch (error) {
    console.error('❌ Error compiling contract:', error);
    res.status(500).json({ 
      error: 'Failed to compile contract',
      details: error.message 
    });
  }
});

// Contract-related endpoints
app.get('/api/contracts', (req, res) => {
  // TODO: Implement contract listing logic
  res.json({ contracts: [] });
});

app.post('/api/contracts', (req, res) => {
  // TODO: Implement contract creation logic
  res.json({ message: 'Contract creation endpoint' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🤖 AI Contract Generation: POST http://localhost:${PORT}/api/generate-contract`);
  console.log(`🔨 Contract Compilation: POST http://localhost:${PORT}/api/compile-contract`);
  
  if (!process.env.OPENAI_API_KEY) {
    console.log(`⚠️  Warning: OPENAI_API_KEY not set. AI features will not work.`);
  }
});
