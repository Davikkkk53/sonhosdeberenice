const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------- MULTER (UPLOAD DE IMAGENS) --------------------
const storage = multer.diskStorage({
    destination: function(req, file, cb){
        const dir = path.join(__dirname, 'uploads');
        if(!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: function(req, file, cb){
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// -------------------- MONGODB --------------------
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let produtosCollection;

async function conectarDB(){
    try{
        await client.connect();
        const db = client.db('sonhosdeberenice');
        produtosCollection = db.collection('produtos');
        console.log('MongoDB conectado!');
    }catch(err){
        console.error('Erro ao conectar MongoDB:', err);
    }
}
conectarDB();

// -------------------- ROTAS --------------------

// GET todos produtos
app.get('/produtos', async (req,res)=>{
    try{
        const produtos = await produtosCollection.find().toArray();
        const produtosFormatados = produtos.map(p => ({
            ...p,
            tamanhos: typeof p.tamanhos === 'string' ? p.tamanhos.split(',') : p.tamanhos
        }));
        res.json(produtosFormatados);
    }catch(err){
        res.status(500).json({erro:err.message});
    }
});

// POST novo produto
app.post('/produtos', upload.single('imagem'), async (req,res)=>{
    try{
        const { nome, tamanhos, preco, preco_antigo, desconto, whatsapp, status } = req.body;
        const imagem = req.file ? `/uploads/${req.file.filename}` : '';
        const novoProduto = {
            nome,
            tamanhos: tamanhos.split(','),
            preco: parseFloat(preco),
            preco_antigo: preco_antigo ? parseFloat(preco_antigo) : null,
            desconto: desconto ? parseInt(desconto) : null,
            whatsapp,
            imagem,
            status
        };
        const result = await produtosCollection.insertOne(novoProduto);
        res.json({id: result.insertedId});
    }catch(err){
        res.status(500).json({erro:err.message});
    }
});

// PATCH alterar status
app.patch('/produtos/:id/status', async (req,res)=>{
    try{
        const { id } = req.params;
        const { status } = req.body;
        await produtosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status } }
        );
        res.json({message:'Status atualizado!'});
    }catch(err){
        res.status(500).json({erro:err.message});
    }
});

// DELETE produto
app.delete('/produtos/:id', async (req,res)=>{
    try{
        const { id } = req.params;
        await produtosCollection.deleteOne({ _id: new ObjectId(id) });
        res.json({message:'Produto deletado!'});
    }catch(err){
        res.status(500).json({erro:err.message});
    }
});

// -------------------- SERVIR FRONTEND --------------------
app.use('/', express.static(path.join(__dirname, 'client')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve index.html mesmo sem /index.html
app.get('/', (req,res)=>{
    res.sendFile(path.join(__dirname,'client/index.html'));
});
app.get('/admin', (req,res)=>{
    res.sendFile(path.join(__dirname,'admin/index.html'));
});

// -------------------- START SERVER --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Servidor rodando na porta ${PORT}`));
