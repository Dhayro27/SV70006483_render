const express = require('express');
const pool = require('../config/database');
const router = express.Router();
const verifyToken = require('../middleware/auth_old');
const { isAdmin } = require('../middleware/authMiddleware');

function generateSKU(product) {
  const name = product.name.substring(0, 3).toUpperCase();
  const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${name}-${randomNum}`;
}

/**
 * @swagger
 * /products:
 *   get:
 *     summary: Obtiene todos los productos activos
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Product'
 */
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
             COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name)) FILTER (WHERE c.id IS NOT NULL), '[]') as categories
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN categories c ON pc.category_id = c.id
      GROUP BY p.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Crea un nuevo producto (solo admin)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre del producto
 *               description:
 *                 type: string
 *                 description: Descripción del producto
 *               price:
 *                 type: number
 *                 format: float
 *                 description: Precio del producto
 *               stock_quantity:
 *                 type: integer
 *                 description: Cantidad en stock
 *               image_url:
 *                 type: string
 *                 description: URL de la imagen del producto
 *     responses:
 *       201:
 *         description: Producto creado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Datos de entrada inválidos
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       409:
 *         description: Conflicto (por ejemplo, SKU duplicado)
 *       500:
 *         description: Error del servidor
 */
router.post('/', verifyToken, isAdmin, async (req, res) => {
  const { name, description, price, stock_quantity, image_url } = req.body;
  
  if (!name || !price) {
    return res.status(400).json({ error: 'El nombre y el precio del producto son requeridos' });
  }

  const sku = generateSKU({ name });

  try {
    const result = await pool.query(
      'INSERT INTO products (name, description, price, stock_quantity, sku, image_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, description, price, stock_quantity, sku, image_url]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (error.code === '23505' && error.constraint === 'products_sku_key') {
      return res.status(409).json({ error: 'El SKU ya existe' });
    }
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Obtiene un producto específico
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalles del producto
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, 
             COALESCE(json_agg(json_build_object('id', c.id, 'name', c.name)) FILTER (WHERE c.id IS NOT NULL), '[]') as categories
      FROM products p
      LEFT JOIN product_categories pc ON p.id = pc.product_id
      LEFT JOIN categories c ON pc.category_id = c.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener el producto:', error);
    res.status(500).json({ error: 'Error al obtener el producto' });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Actualiza un producto existente (solo admin)
 *     tags: [Products]
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre del producto
 *               description:
 *                 type: string
 *                 description: Descripción del producto
 *               price:
 *                 type: number
 *                 format: float
 *                 description: Precio del producto
 *               stock_quantity:
 *                 type: integer
 *                 description: Cantidad en stock
 *               image_url:
 *                 type: string
 *                 description: URL de la imagen del producto
 *     responses:
 *       200:
 *         description: Producto actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       404:
 *         description: Producto no encontrado
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       500:
 *         description: Error del servidor
 */
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
  const { name, description, price, stock_quantity, image_url } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE products SET name = COALESCE($1, name), description = COALESCE($2, description), price = COALESCE($3, price), stock_quantity = COALESCE($4, stock_quantity), image_url = COALESCE($5, image_url), updated_at = CURRENT_TIMESTAMP WHERE id = $6 AND is_active = true RETURNING *',
      [name, description, price, stock_quantity, image_url, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar el producto:', error);
    res.status(500).json({ error: 'Error al actualizar el producto' });
  }
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Desactiva un producto (soft delete, solo admin)
 *     tags: [Products]
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
 *         description: Producto desactivado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE products SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_active = true RETURNING *',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado o ya está desactivado' });
    }
    
    res.json({ message: 'Producto desactivado correctamente' });
  } catch (error) {
    console.error('Error al desactivar el producto:', error);
    res.status(500).json({ error: 'Error al desactivar el producto' });
  }
});

/**
 * @swagger
 * /products/{id}/activate:
 *   patch:
 *     summary: Reactiva un producto desactivado (solo admin)
 *     tags: [Products]
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
 *         description: Producto reactivado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Producto no encontrado o ya está activo
 *       401:
 *         description: No autorizado
 *       403:
 *         description: Acceso prohibido
 *       500:
 *         description: Error del servidor
 */
router.patch('/:id/activate', verifyToken, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE products SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_active = false RETURNING *',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado o ya está activo' });
    }
    
    res.json({ message: 'Producto reactivado correctamente', product: result.rows[0] });
  } catch (error) {
    console.error('Error al reactivar el producto:', error);
    res.status(500).json({ error: 'Error al reactivar el producto' });
  }
});

/**
 * @swagger
 * /products/{id}/categories:
 *   post:
 *     summary: Asigna categorías a un producto
 *     tags: [Products]
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
 *             properties:
 *               category_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Categorías asignadas correctamente
 *       400:
 *         description: Error en la solicitud
 *       404:
 *         description: Producto no encontrado
 *       500:
 *         description: Error del servidor
 */
router.post('/:id/categories', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { category_ids } = req.body;

  if (!Array.isArray(category_ids) || category_ids.length === 0) {
    return res.status(400).json({ error: 'Se debe proporcionar un array de IDs de categorías' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Verificar si el producto existe
    const productResult = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Eliminar las asignaciones existentes
    await client.query('DELETE FROM product_categories WHERE product_id = $1', [id]);

    // Insertar las nuevas asignaciones
    for (let category_id of category_ids) {
      await client.query(
        'INSERT INTO product_categories (product_id, category_id) VALUES ($1, $2)',
        [id, category_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Categorías asignadas correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al asignar categorías:', error);
    res.status(500).json({ error: 'Error al asignar categorías' });
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *       properties:
 *         id:
 *           type: integer
 *           description: ID auto-generado del producto
 *         name:
 *           type: string
 *           description: Nombre del producto
 *         description:
 *           type: string
 *           description: Descripción del producto
 *         price:
 *           type: number
 *           format: float
 *           description: Precio del producto
 *         stock_quantity:
 *           type: integer
 *           description: Cantidad en stock
 *         sku:
 *           type: string
 *           description: SKU único del producto
 *         image_url:
 *           type: string
 *           description: URL de la imagen del producto
 *         is_active:
 *           type: boolean
 *           description: Estado de activación del producto
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de última actualización
 */

module.exports = router;