import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { MercadoPagoConfig, Payment } from 'mercadopago'

const app = express()
const prisma = new PrismaClient()

const client = new MercadoPagoConfig({ 
  accessToken: 'APP_USR-606934439694639-022213-b2993e6cecd9cd0767e336fd843cdc28-1521253988' 
});
const payment = new Payment(client);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'DELETE', 'PATCH'], allowedHeaders: ['Content-Type', 'ngrok-skip-browser-warning'] }))
app.use(express.json())

app.post('/agendamentos', async (req, res) => {
  const { userId, date, service, price, userName } = req.body
  try {
    const agendamento = await prisma.appointment.create({
      data: { userId: String(userId), date: new Date(date), service, price: parseFloat(price), status: "Pendente" }
    })
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
  } catch (error) { res.status(400).json({ error: "Erro PIX" }); }
})

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

app.get('/admin/agendamentos', async (req, res) => {
  try {
    const agendamentos = await prisma.appointment.findMany({ include: { user: true }, orderBy: { date: 'asc' } })
    const hoje = new Date().toLocaleDateString('pt-BR');
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
    const amanhaStr = amanha.toLocaleDateString('pt-BR');

    const fHoje = agendamentos.filter(a => a.status === "Concluído" && new Date(a.date).toLocaleDateString('pt-BR') === hoje)
      .reduce((sum, a) => sum + Number(a.price), 0);
    const fAmanha = agendamentos.filter(a => a.status === "Concluído" && new Date(a.date).toLocaleDateString('pt-BR') === amanhaStr)
      .reduce((sum, a) => sum + Number(a.price), 0);

    res.json({ agendamentos, faturamento: fHoje, previsao: fAmanha })
  } catch (error) { res.status(500).json({ error: "Erro" }) }
})

app.delete('/admin/agendamentos/:id', async (req, res) => {
  await prisma.appointment.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
})

app.listen(3333, () => console.log("🚀 NEX SERVER ON"));