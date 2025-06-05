const express = require('express');
const stripe = require('../config/stripe');
const pool = require('../config/database');
const router = express.Router();
const verifyToken = require('../middleware/auth_old');

router.post('/', verifyToken, async (req, res) => {
  const { orderId } = req.body;

  try {
    const [orderRows] = await pool.query('SELECT * FROM orders WHERE id = ? AND user_id = ?', [orderId, req.user.id]);
    
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const order = orderRows[0];

    if (order.status !== 'completed') {
      return res.status(400).json({ error: 'La orden no está en estado completado' });
    }

    const paymentIntentId = order.stripe_payment_intent_id;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'No se encontró el ID de la intención de pago' });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId
    });

    await pool.query('UPDATE orders SET status = ? WHERE id = ?', ['refunded', order.id]);

    res.json({ success: true, refundId: refund.id });
  } catch (error) {
    console.error('Error al procesar la devolución:', error);
    res.status(500).json({ error: 'Error al procesar la devolución' });
  }
});

module.exports = router;