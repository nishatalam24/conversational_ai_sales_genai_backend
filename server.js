// server.js
const express = require('express');
require('dotenv').config();
const { askAgent } = require('./agent-controller'); // <-- make sure the path is correct

const app = express();
app.use(express.json());

app.post('/chat', askAgent);

app.listen(5001, () => console.log('Server running on http://localhost:5001'));
