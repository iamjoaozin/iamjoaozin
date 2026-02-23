import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const app = express()
const prisma = new PrismaClient()

// Configuração Mercado Pago
const client = new MercadoPagoConfig({ 
  accessToken: 'APP_USR-606934439694639-022213-b2993e6cecd9cd0767e336fd843cdc28-1521253988' 
});
const payment = new Payment(client);

// Middlewares - CORS configurado para aceitar tudo e evitar erros no Front
app.use(cors({ 
  origin: '*', 
  methods: ['GET', 'POST', 'DELETE', 'PATCH'], 
  allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'] 
}))
app.use(express.json())

// --- ROTAS DE SERVIÇOS (FALTAVAM ESTAS) ---
app.get('/servicos', async (req, res) => {
  try {
    const servicos = await prisma.service.findMany()
    res.json(servicos)
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar serviços" })
  }
})

app.post('/servicos', async (req, res) => {
  const { nome, preco, tempo } = req.body
  try {
    const novo = await prisma.service.create({
      data: { nome, preco: parseFloat(preco), tempo }
    })
    res.json(novo)
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar serviço" })
  }
})

app.delete('/servicos/:id', async (req, res) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (error) {
    res.status(400).json({ error: "Erro ao deletar serviço" })
  }
})

// --- ROTAS DE AGENDAMENTOS ---
app.post('/agendamentos', async (req, res) => {
  const { userId, date, service, price, userName } = req.body
  try {
    const agendamento = await prisma.appointment.create({
      data: { 
        userId: String(userId || "ADMIN_MANUAL"), 
        date: new Date(date), 
        service, 
        price: parseFloat(price || 0), 
        status: "Pendente" 
      }
    })
    
    // Se o preço for 0 (agendamento manual), não tenta gerar PIX
    if (parseFloat(price) <= 0) {
      return res.json({ agendamentoId: agendamento.id, manual: true });
    }

    const paymentData = {
      body: {
        transaction_amount: parseFloat(price),
        description: `NEX Barber - ${service}`,
        payment_method_id: 'pix',
        payer: { email: 'cliente@nexbarber.com', first_name: userName || 'Cliente' },
        notification_url: 'https://nonspinose-nondeprecatingly-raymon.ngrok-free.dev/webhook',
        external_reference: agendamento.id,
      }
    };
    const result = await payment.create(paymentData);
    res.json({
      agendamentoId: agendamento.id,
      pixCopiaECola: result.point_of_interaction.transaction_data.qr_code,
      qrCodeBase64: result.point_of_interaction.transaction_data.qr_code_base64
    });
  } catch (error) { 
    console.error(error);
    res.status(400).json({ error: "Erro ao processar agendamento" }); 
  }
})

app.get('/admin/agendamentos', async (req, res) => {
  try {
    // Removido o include: { user: true } se você não tiver a relação de usuário obrigatória para evitar erros
    const agendamentos = await prisma.appointment.findMany({ orderBy: { date: 'asc' } })
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    const fHoje = agendamentos
      .filter(a => a.status === "Concluído" && new Date(a.date).toLocaleDateString('pt-BR') === hoje)
      .reduce((sum, a) => sum + Number(a.price), 0);

    res.json({ agendamentos, faturamento: fHoje, previsao: 0 })
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: "Erro ao carregar dados" }) 
  }
})

app.delete('/admin/agendamentos/:id', async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar" });
  }
})

// Webhook
app.post('/webhook', async (req, res) => {
  const { action, data } = req.body;
  if (action === "payment.updated") {
    try {
      const p = await payment.get({ id: data.id });
      if (p.status === 'approved') {
        await prisma.appointment.update({
          where: { id: p.external_reference },
          data: { status: "Concluído" }
        });
      }
    } catch (err) { console.error(err); }
  }
  res.sendStatus(200);
})

// 🚀 AJUSTE DA PORTA PARA O RENDER
const PORT = process.env.PORT || 3333;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 NEX SERVER ON PORT ${PORT}`));