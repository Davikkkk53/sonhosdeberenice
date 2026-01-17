const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configuração do multer para upload de imagens
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

// Conexão MongoDB
const uri = "mongodb+srv://admin:sua_senha@cluster0.mongodb.net/sonhosdeberenice?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let produtosCollection;

async function conectarDB(){
    await client.connect();
    const db = client.db('sonhosdeberenice');
    produtosCollection = db.collection('produtos');
    console.log('Conectado ao MongoDB!');
}
conectarDB().catch(console.error);

// Rotas

// GET todos produtos
app.get('/produtos', async (req,res)=>{
    try{
        const produtos = await produtosCollection.find().toArray();
        const produtosFormatados = produtos.map(p => ({
            ...p,
            tamanhos: typeof p.tamanhos === 'string' ? p.tamanhos.split(',') : p.tamanhos
        }));
        res.json(produtosFormatados);
    } catch(err){
        res.status(500).json({erro:err.message});
    }
});

// POST novo produto
app.post('/produtos', upload.single('imagem'), async (req,res)=>{
    try{
        const {nome, tamanhos, preco, preco_antigo, desconto, whatsapp, status} = req.body;
        const imagem = req.file ? `uploads/${req.file.filename}` : '';
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
    } catch(err){
        res.status(500).json({erro:err.message});
    }
});

// Servir front-end opcionalmente
app.use('/', express.static(path.join(__dirname, '../client')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Servidor rodando na porta ${PORT}`));
