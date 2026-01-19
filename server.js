const express = require('express');
const cors = require('cors');
const multer = require('multer');
const session = require('express-session');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- SESSION (LOGIN ADMIN) ----
app.use(session({
    secret: 'painelAdminCatalogo',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// ---- MULTER UPLOAD ----
const storage = multer.diskStorage({
    destination(req, file, cb){
        const dir = path.join(__dirname, 'uploads');
        if(!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename(req, file, cb){
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ---- MONGODB ----
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let produtosCollection;

async function conectarDB(){
    await client.connect();
    const db = client.db('sonhosdeberenice');
    produtosCollection = db.collection('produtos');
    console.log('MongoDB conectado!');
}
conectarDB();

// ---- MIDDLEWARE DE PROTEÇÃO DO ADMIN ----
function protegerAdmin(req, res, next){
    if(req.session && req.session.logado === true) return next();
    return res.redirect('/login-admin');
}

// ---- ROTAS DE AUTENTICAÇÃO ----
app.get('/login-admin', (req,res)=>{
    res.send(`
    <form method="POST" action="/login-admin" style="font-family:Arial;max-width:300px;margin:50px auto;display:flex;flex-direction:column;gap:10px;">
        <h3>Login Admin</h3>
        <input name="user" placeholder="Usuário" required>
        <input name="pass" placeholder="Senha" type="password" required>
        <button type="submit">Entrar</button>
    </form>
    `);
});

app.post('/login-admin', express.urlencoded({extended:true}), (req,res)=>{
    const { user, pass } = req.body;

    if(user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS){
        req.session.logado = true;
        return res.redirect('/admin');
    }

    return res.send('<p>Credenciais inválidas. <a href="/login-admin">Tentar novamente</a></p>');
});

app.get('/logout', (req,res)=>{
    req.session.destroy();
    res.redirect('/login-admin');
});

// ---- API PRODUTOS (SEM ALTERAR) ----
app.get('/produtos', async (req,res)=>{
    const produtos = await produtosCollection.find().toArray();
    const formatados = produtos.map(p => ({
        ...p,
        tamanhos: typeof p.tamanhos === 'string' ? p.tamanhos.split(',') : p.tamanhos
    }));
    res.json(formatados);
});

app.post('/produtos', upload.single('imagem'), async (req,res)=>{
    const { nome, tamanhos, preco, preco_antigo, desconto, whatsapp, status } = req.body;
    const imagem = req.file ? `/uploads/${req.file.filename}` : '';

    const novo = {
        nome,
        tamanhos: tamanhos.split(','),
        preco: parseFloat(preco),
        preco_antigo: preco_antigo ? parseFloat(preco_antigo) : null,
        desconto: desconto ? parseInt(desconto) : null,
        whatsapp,
        imagem,
        status
    };

    const result = await produtosCollection.insertOne(novo);
    res.json({ id: result.insertedId });
});

app.patch('/produtos/:id/status', async (req,res)=>{
    await produtosCollection.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: req.body.status } }
    );
    res.json({ ok:true });
});

app.delete('/produtos/:id', async (req,res)=>{
    await produtosCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok:true });
});

// ---- FRONT CLIENT ----
app.use('/', express.static(path.join(__dirname, 'client')));
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'client/index.html')));

// ---- FRONT ADMIN (PROTEGIDO) ----
app.use('/admin', protegerAdmin, express.static(path.join(__dirname, 'admin')));
app.get('/admin', protegerAdmin, (req,res)=> res.sendFile(path.join(__dirname,'admin/index.html')));

// ---- START ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`Servidor rodando na porta ${PORT}`));
