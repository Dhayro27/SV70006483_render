const express = require('express');
const pool = require('../config/database');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /addresses:
 *   get:
 *     summary: Obtiene todas las direcciones del usuario autenticado
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de direcciones
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Address'
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM addresses WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener direcciones:', error);
    res.status(500).json({ error: 'Error al obtener direcciones' });
  }
});

/**
 * @swagger
 * /addresses:
 *   post:
 *     summary: Crea una nueva dirección
 *     tags: [Addresses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       201:
 *         description: Dirección creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 */
router.post('/', verifyToken, async (req, res) => {
  const { address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;
  
  if (!address_line1 || !city || !postal_code || !country) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO addresses (user_id, address_line1, address_line2, city, state, postal_code, country, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.user.id, address_line1, address_line2, city, state, postal_code, country, is_default]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear dirección:', error);
    res.status(500).json({ error: 'Error al crear dirección' });
  }
});

/**
 * @swagger
 * /addresses/{id}:
 *   get:
 *     summary: Obtiene una dirección específica
 *     tags: [Addresses]
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
 *         description: Detalles de la dirección
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener la dirección:', error);
    res.status(500).json({ error: 'Error al obtener la dirección' });
  }
});

/**
 * @swagger
 * /addresses/{id}:
 *   put:
 *     summary: Actualiza una dirección existente
 *     tags: [Addresses]
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
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Dirección actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Address'
 */
router.put('/:id', verifyToken, async (req, res) => {
  const { address_line1, address_line2, city, state, postal_code, country, is_default } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE addresses SET address_line1 = COALESCE($1, address_line1), address_line2 = COALESCE($2, address_line2), city = COALESCE($3, city), state = COALESCE($4, state), postal_code = COALESCE($5, postal_code), country = COALESCE($6, country), is_default = COALESCE($7, is_default) WHERE id = $8 AND user_id = $9 RETURNING *',
      [address_line1, address_line2, city, state, postal_code, country, is_default, req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar la dirección:', error);
    res.status(500).json({ error: 'Error al actualizar la dirección' });
  }
});

/**
 * @swagger
 * /addresses/{id}:
 *   delete:
 *     summary: Elimina una dirección
 *     tags: [Addresses]
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
 *         description: Dirección eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dirección no encontrada' });
    }
    
    res.json({ message: 'Dirección eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar la dirección:', error);
    res.status(500).json({ error: 'Error al eliminar la dirección' });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Address:
 *       type: object
 *       required:
 *         - address_line1
 *         - city
 *         - postal_code
 *         - country
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-generado de la dirección
 *         user_id:
 *           type: integer
 *           description: ID del usuario al que pertenece la dirección
 *         address_line1:
 *           type: string
 *           description: Primera línea de la dirección
 *         address_line2:
 *           type: string
 *           description: Segunda línea de la dirección (opcional)
 *         city:
 *           type: string
 *           description: Ciudad
 *         state:
 *           type: string
 *           description: Estado o provincia
 *         postal_code:
 *           type: string
 *           description: Código postal
 *         country:
 *           type: string
 *           description: País
 *         is_default:
 *           type: boolean
 *           description: Indica si es la dirección predeterminada del usuario
 */

module.exports = router;