// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// MIDDLEWARES
// ---------------------------

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'muitosecreto',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------
// MIDDLEWARES de Autenticação
// ---------------------------

function checkAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  return res.redirect('/');
}

function checkAdmin(req, res, next) {
  if (req.session.role === 'ADMIN') {
    return next();
  }
  return res.status(403).send('Acesso negado.');
}

function checkEmployee(req, res, next) {
  if (req.session.role === 'EMPLOYEE') {
    return next();
  }
  return res.status(403).send('Acesso negado.');
}

// ---------------------------
// ROTAS de Autenticação
// ---------------------------

app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.redirect('/?error=Dados incompletos');
  }

  const user = await prisma.usuario.findUnique({
    where: { username },
  });

  if (!user) {
    return res.redirect('/?error=Usuário não encontrado');
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.redirect('/?error=Senha incorreta');
  }

  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role;

  if (user.role === 'ADMIN') {
    return res.redirect('/admin');
  } else {
    return res.redirect('/employee');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ---------------------------
// ROTAS de PÁGINAS
// ---------------------------

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/employee', checkAuthenticated, checkEmployee, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

app.get('/qrcode', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'qrcode.html'));
});

// ---------------------------
// ROTAS de API (JSON) – protegidas
// ---------------------------

app.get('/api/products', checkAuthenticated, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany();
    return res.json(produtos);
  } catch (err) {
    console.error('ERRO ao listar produtos:', err);
    return res.status(500).json({ error: 'Erro interno ao listar produtos.' });
  }
});

app.post('/api/products', checkAuthenticated, checkAdmin, async (req, res) => {
  const { nome, quantidade, validade } = req.body;
  try {
    const novo = await prisma.produto.create({
      data: {
        nome,
        quantidade: Number(quantidade),
        validade: new Date(validade),
      },
    });
    return res.json(novo);
  } catch (err) {
    console.error('ERRO ao criar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao criar produto.' });
  }
});

app.put('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, quantidade, validade } = req.body;
  try {
    const atualizado = await prisma.produto.update({
      where: { id: Number(id) },
      data: {
        nome,
        quantidade: Number(quantidade),
        validade: new Date(validade),
      },
    });
    return res.json(atualizado);
  } catch (err) {
    console.error('ERRO ao atualizar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao atualizar produto.' });
  }
});

app.delete('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.produto.delete({ where: { id: Number(id) } });
    return res.json({ message: 'Deletado com sucesso.' });
  } catch (err) {
    console.error('ERRO ao deletar produto:', err);
    return res.status(500).json({ error: 'Erro interno ao deletar produto.' });
  }
});

app.get(
  '/api/retiradas',
  checkAuthenticated,
  checkAdmin,
  async (req, res) => {
    try {
      const dados = await prisma.retirada.findMany({
        orderBy: { data: 'desc' },
        include: {
          produto: true,
          usuario: true,
        },
      });
      const formatado = dados.map((r) => ({
        id: r.id,
        produtoId: r.produtoId,
        produtoNome: r.produto.nome,
        usuarioId: r.usuarioId,
        usuarioNome: r.usuario.username,
        quantidade: r.quantidade,
        data: r.data,
      }));
      return res.json(formatado);
    } catch (err) {
      console.error('ERRO ao listar retiradas:', err);
      return res.status(500).json({ error: 'Erro interno ao listar retiradas.' });
    }
  }
);

app.post(
  '/api/retiradas',
  checkAuthenticated,
  checkEmployee,
  async (req, res) => {
    const { produtoId, quantidade } = req.body;
    const usuarioId = req.session.userId;

    // 1) busca produto
    const prod = await prisma.produto.findUnique({
      where: { id: Number(produtoId) },
    });
    if (!prod) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }
    if (prod.quantidade < Number(quantidade)) {
      return res.status(400).json({ error: 'Estoque insuficiente.' });
    }

    // 2) atualiza estoque
    const novaQtde = prod.quantidade - Number(quantidade);
    await prisma.produto.update({
      where: { id: Number(produtoId) },
      data: { quantidade: novaQtde },
    });

    // 3) cria registro de retirada
    const retirada = await prisma.retirada.create({
      data: {
        produto: { connect: { id: Number(produtoId) } },
        usuario: { connect: { id: usuarioId } },
        quantidade: Number(quantidade),
      },
    });

    return res.json({
      message: 'Retirada registrada.',
      retiradaId: retirada.id,
      novaQuantidade: novaQtde,
    });
  }
);

// 404 PARA ROTAS NÃO TRATADAS
app.use((req, res) => {
  res.status(404).send('Rota não encontrada');
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
