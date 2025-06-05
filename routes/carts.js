const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, isAdminOrCustomer } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /carts:
 *   get:
 *     summary: Obtiene el carrito del usuario autenticado
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Carrito del usuario
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Cart'
 */
router.get('/', verifyToken, isAdminOrCustomer, async (req, res) => {
  try {
    let result = await pool.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
    let cart;

    if (result.rows.length === 0) {
      // Si no existe un carrito, crear uno nuevo
      const newCartResult = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING *', [req.user.id]);
      cart = newCartResult.rows[0];
      cart.items = []; // Inicializar con un array vacío
    } else {
      cart = result.rows[0];

      // Obtener los items del carrito
      const itemsResult = await pool.query(`
        SELECT ci.*, p.name, p.price
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = $1
      `, [cart.id]);

      cart.items = itemsResult.rows;
    }

    res.json(cart);
  } catch (error) {
    console.error('Error al obtener el carrito:', error);
    res.status(500).json({ error: 'Error al obtener el carrito' });
  }
});

/**
 * @swagger
 * /carts/items:
 *   post:
 *     summary: Añade un item al carrito
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - product_id
 *               - quantity
 *             properties:
 *               product_id:
 *                 type: integer
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Item añadido al carrito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartItem'
 */
router.post('/items', verifyToken, isAdminOrCustomer, async (req, res) => {
  const { product_id, quantity } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Obtener o crear el carrito del usuario
    let cartResult = await client.query('SELECT * FROM carts WHERE user_id = $1', [req.user.id]);
    if (cartResult.rows.length === 0) {
      cartResult = await client.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING *', [req.user.id]);
    }
    const cart_id = cartResult.rows[0].id;

    // Verificar si el producto ya está en el carrito
    const existingItemResult = await client.query('SELECT * FROM cart_items WHERE cart_id = $1 AND product_id = $2', [cart_id, product_id]);
    
    let result;
    if (existingItemResult.rows.length > 0) {
      // Actualizar la cantidad si el producto ya está en el carrito
      result = await client.query(
        'UPDATE cart_items SET quantity = quantity + $1 WHERE cart_id = $2 AND product_id = $3 RETURNING *',
        [quantity, cart_id, product_id]
      );
    } else {
      // Añadir nuevo item al carrito
      result = await client.query(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3) RETURNING *',
        [cart_id, product_id, quantity]
      );
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al añadir item al carrito:', error);
    res.status(500).json({ error: 'Error al añadir item al carrito' });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /carts/items/{id}:
 *   put:
 *     summary: Actualiza la cantidad de un item en el carrito
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quantity
 *             properties:
 *               quantity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Item actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CartItem'
 */
router.put('/items/:id', verifyToken, isAdminOrCustomer, async (req, res) => {
  const { quantity } = req.body;
  const itemId = req.params.id;

  try {
    const result = await pool.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id IN (SELECT id FROM carts WHERE user_id = $3) RETURNING *',
      [quantity, itemId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado en el carrito' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar item del carrito:', error);
    res.status(500).json({ error: 'Error al actualizar item del carrito' });
  }
});

/**
 * @swagger
 * /carts/items/{id}:
 *   delete:
 *     summary: Elimina un item del carrito
 *     tags: [Carts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item eliminado del carrito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.delete('/items/:id', verifyToken, isAdminOrCustomer, async (req, res) => {
  const itemId = req.params.id;

  try {
    const result = await pool.query(
      'DELETE FROM cart_items WHERE id = $1 AND cart_id IN (SELECT id FROM carts WHERE user_id = $2) RETURNING *',
      [itemId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado en el carrito' });
    }

    res.json({ message: 'Item eliminado del carrito' });
  } catch (error) {
    console.error('Error al eliminar item del carrito:', error);
    res.status(500).json({ error: 'Error al eliminar item del carrito' });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Cart:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         user_id:
 *           type: integer
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CartItem'
 *     CartItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         cart_id:
 *           type: integer
 *         product_id:
 *           type: integer
 *         quantity:
 *           type: integer
 *         name:
 *           type: string
 *         price:
 *           type: number
 */

module.exports = router;