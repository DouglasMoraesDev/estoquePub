// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// MIDDLEWARES
// ---------------------------

// Body parser para JSON e urlencoded
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Sessão
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

// Servir arquivos estáticos de 'public'
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

// GET "/" → login (serve index.html)
app.get('/', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST "/login" → processa login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.redirect('/?error=Dados incompletos');
  }

  // 1) busca usuário no banco
  const user = await prisma.usuario.findUnique({
    where: { username },
  });

  if (!user) {
    return res.redirect('/?error=Usuário não encontrado');
  }

  // 2) compara senha
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.redirect('/?error=Senha incorreta');
  }

  // 3) cria sessão
  req.session.userId = user.id;
  req.session.username = user.username;
  req.session.role = user.role; // "ADMIN" ou "EMPLOYEE"

  // 4) redireciona para a área correta
  if (user.role === 'ADMIN') {
    return res.redirect('/admin');
  } else {
    return res.redirect('/employee');
  }
});

// GET "/logout" → destrói sessão
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Qual modo estamos rodando?
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Modo: ${process.env.NODE_ENV}`);

// Agora, por exemplo, você pode forçar logs mais verbosos em dev:
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`[DEV] ${req.method} ${req.url}`);
    next();
  });
}

// ---------------------------
// ROTAS de PÁGINAS
// ---------------------------

// /admin → admin.html (apenas ADMIN autenticado)
app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// /employee → employee.html (apenas EMPLOYEE autenticado)
app.get('/employee', checkAuthenticated, checkEmployee, (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'employee.html'));
});

// /qrcode → qrcode.html (aberto para todos, gera QR que aponta para /employee)
app.get('/qrcode', (req, res) => {
  return res.sendFile(path.join(__dirname, 'public', 'qrcode.html'));
});

// ---------------------------
// ROTAS de API (JSON) – protegidas
// ---------------------------

/** 
 * API de Produtos:
 *   GET    /api/products         → lista todos (ADMIN e EMPLOYEE)
 *   POST   /api/products         → cria novo (somente ADMIN)
 *   PUT    /api/products/:id     → atualiza (somente ADMIN)
 *   DELETE /api/products/:id     → apaga (somente ADMIN)
 */
app.get('/api/products', checkAuthenticated, async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany();
    return res.json(produtos);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', checkAuthenticated, checkAdmin, async (req, res) => {
  const { nome, quantidade, unidade, validade } = req.body;
  try {
    const novo = await prisma.produto.create({
      data: {
        nome,
        quantidade: Number(quantidade),
        unidade,
        validade: new Date(validade),
      },
    });
    return res.json(novo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, quantidade, unidade, validade } = req.body;
  try {
    const atualizado = await prisma.produto.update({
      where: { id: Number(id) },
      data: {
        nome,
        quantidade: Number(quantidade),
        unidade,
        validade: new Date(validade),
      },
    });
    return res.json(atualizado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', checkAuthenticated, checkAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.produto.delete({ where: { id: Number(id) } });
    return res.json({ message: 'Deletado com sucesso.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * API de Retiradas:
 *   GET    /api/retiradas          → lista todas (somente ADMIN)
 *   POST   /api/retiradas          → registra (somente EMPLOYEE)
 */
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
      // Formata saída
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
      return res.status(500).json({ error: err.message });
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

// ---------------------------
// 404 PARA ROTAS NÃO TRATADAS
// ---------------------------
app.use((req, res) => {
  res.status(404).send('Rota não encontrada');
});

// ---------------------------
// INICIAR SERVIDOR
// ---------------------------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
});
