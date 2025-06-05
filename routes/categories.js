const express = require('express');
const pool = require('../config/database');
const router = express.Router();
const verifyToken = require('../middleware/auth_old');
const { isAdmin } = require('../middleware/authMiddleware');

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Obtiene todas las categorías
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Lista de categorías
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Crea una nueva categoría (solo admin)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       201:
 *         description: Categoría creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  const { name, description, parent_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre de la categoría es requerido' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO categories (name, description, parent_id) VALUES ($1, $2, $3) RETURNING *',
      [name, description, parent_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   get:
 *     summary: Obtiene una categoría específica
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalles de la categoría
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener la categoría:', error);
    res.status(500).json({ error: 'Error al obtener la categoría' });
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   put:
 *     summary: Actualiza una categoría existente (solo admin)
 *     tags: [Categories]
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
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       200:
 *         description: Categoría actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const { name, description, parent_id } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), parent_id = COALESCE($3, parent_id) WHERE id = $4 RETURNING *',
      [name, description, parent_id, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar la categoría:', error);
    res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Elimina una categoría (solo admin)
 *     tags: [Categories]
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
 *         description: Categoría eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: No se puede eliminar la categoría porque tiene subcategorías
 *       404:
 *         description: Categoría no encontrada
 *       500:
 *         description: Error del servidor
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const subcategoriesResult = await client.query('SELECT COUNT(*) FROM categories WHERE parent_id = $1', [req.params.id]);
    // console.log('Subcategorías result:', subcategoriesResult);
    const subcategoriesCount = parseInt(subcategoriesResult.rows[0].count);

    if (subcategoriesCount > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No se puede eliminar la categoría porque tiene subcategorías' });
    }

    const result = await client.query('DELETE FROM categories WHERE id = $1 RETURNING *', [req.params.id]);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Categoría eliminada correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al eliminar la categoría:', error);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /categories/{id}/products:
 *   get:
 *     summary: Obtiene todos los productos de una categoría específica
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de productos de la categoría
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get('/:id/products', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*
      FROM products p
      JOIN product_categories pc ON p.id = pc.product_id
      WHERE pc.category_id = $1
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos de la categoría:', error);
    res.status(500).json({ error: 'Error al obtener productos de la categoría' });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-generado de la categoría
 *         name:
 *           type: string
 *           description: Nombre de la categoría
 *         description:
 *           type: string
 *           description: Descripción de la categoría (opcional)
 *         parent_id:
 *           type: integer
 *           description: ID de la categoría padre (opcional, para categorías anidadas) debe empezar con null si no es una subcategoría
 */

module.exports = router;