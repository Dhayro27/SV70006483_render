const express = require('express');
const pool = require('../config/database');
const router = express.Router();
const verifyToken = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener las órdenes:', error);
    res.status(500).json({ error: 'Error al obtener las órdenes' });
  }
});

router.post('/', verifyToken, async (req, res) => {
    console.log('Creating order. User:', req.user); // Log para depuración

    if (!req.user || !req.user.id) {
        console.log('User not authenticated or user ID not available'); // Log para depuración
        return res.status(401).json({ error: 'Usuario no autenticado o ID de usuario no disponible' });
    }

    const { items } = req.body;
    console.log('Order items:', items); // Log para depuración
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        console.log('Invalid items in order request'); // Log para depuración
        return res.status(400).json({ error: 'Se requiere al menos un item para crear una orden' });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        console.log('Creating order for user ID:', req.user.id); // Log para depuración

        const orderResult = await client.query(
            'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, 0, $2) RETURNING id',
            [req.user.id, 'pending']
        );
        const orderId = orderResult.rows[0].id;

        console.log('Order created with ID:', orderId); // Log para depuración

        let totalAmount = 0;
        for (const item of items) {
            console.log('Processing item:', item); // Log para depuración

            const productResult = await client.query(
                'SELECT price FROM products WHERE id = $1',
                [item.product_id]
            );
            
            if (productResult.rows.length === 0) {
                throw new Error(`Producto no encontrado: ${item.product_id}`);
            }

            const price = productResult.rows[0].price;
            const itemTotal = price * item.quantity;
            totalAmount += itemTotal;

            await client.query(
                'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
                [orderId, item.product_id, item.quantity, price]
            );
        }

        await client.query(
            'UPDATE orders SET total_amount = $1 WHERE id = $2',
            [totalAmount, orderId]
        );

        await client.query('COMMIT');

        const orderDetails = await client.query(
            'SELECT * FROM orders WHERE id = $1',
            [orderId]
        );
        const orderItems = await client.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [orderId]
        );

        console.log('Order created successfully:', orderDetails.rows[0]); // Log para depuración

        res.status(201).json({
            ...orderDetails.rows[0],
            items: orderItems.rows
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al crear la orden:', error);
        res.status(500).json({ error: 'Error al crear la orden' });
    } finally {
        client.release();
    }
});

router.get('/:id', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const [items] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [req.params.id]
    );

    res.json({ ...orders[0], items });
  } catch (error) {
    console.error('Error al obtener la orden:', error);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
});

router.put('/:id/status', verifyToken, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  const { status } = req.body;
  
  if (!status || !['pending', 'completed', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'Estado de orden inválido' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE id = ? AND user_id = ?',
      [status, req.params.id, req.user.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }
    
    res.json({ message: 'Estado de orden actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar el estado de la orden:', error);
    res.status(500).json({ error: 'Error al actualizar el estado de la orden' });
  }
});

module.exports = router;