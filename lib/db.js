import { createClient } from '@libsql/client';

// Conexión a Turso
// Usaremos variables de entorno para producción y archivo local para pruebas
const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const client = createClient({
  url: url,
  authToken: authToken,
});

// Función para inicializar las tablas
export const initDb = async () => {
  try {
    console.log("Verificando/Creando tablas en la base de datos...");

    // Tabla Usuarios
    await client.execute(`
      CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          correo TEXT UNIQUE NOT NULL,
          hash_contrasena TEXT NOT NULL,
          rol TEXT DEFAULT 'admin',
          fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla Configuración
    await client.execute(`
      CREATE TABLE IF NOT EXISTS configuracion_sistema (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          valor_mensual INTEGER NOT NULL,
          moneda TEXT DEFAULT 'COP',
          nombre_escuela TEXT,
          telefono_contacto TEXT,
          fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla Categorías
    await client.execute(`
      CREATE TABLE IF NOT EXISTS categorias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          edad_minima INTEGER NOT NULL,
          edad_maxima INTEGER NOT NULL
      )
    `);

    // Tabla Acudientes
    await client.execute(`
      CREATE TABLE IF NOT EXISTS acudientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          telefono TEXT
      )
    `);

    // Tabla Jugadores
    await client.execute(`
      CREATE TABLE IF NOT EXISTS jugadores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombres TEXT NOT NULL,
          apellidos TEXT NOT NULL,
          fecha_nacimiento DATE NOT NULL,
          tipo_sangre TEXT,
          telefono TEXT,
          id_acudiente INTEGER,
          id_categoria INTEGER,
          fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_acudiente) REFERENCES acudientes(id),
          FOREIGN KEY (id_categoria) REFERENCES categorias(id)
      )
    `);

    // Tabla Pagos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS pagos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_jugador INTEGER NOT NULL,
          monto INTEGER NOT NULL,
          fecha_pago DATE NOT NULL,
          metodo_pago TEXT,
          notas TEXT,
          fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_jugador) REFERENCES jugadores(id)
      )
    `);

    // Tabla Aplicación Pagos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS aplicacion_pagos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_pago INTEGER NOT NULL,
          anio INTEGER NOT NULL,
          mes INTEGER NOT NULL,
          monto_aplicado INTEGER NOT NULL,
          UNIQUE(id_pago, anio, mes),
          FOREIGN KEY (id_pago) REFERENCES pagos(id)
      )
    `);

    // Tabla Inventario Items
    await client.execute(`
      CREATE TABLE IF NOT EXISTS inventario_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          categoria TEXT,
          stock INTEGER NOT NULL DEFAULT 0,
          stock_minimo INTEGER DEFAULT 0,
          fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla Inventario Movimientos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS inventario_movimientos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_item INTEGER NOT NULL,
          tipo_movimiento TEXT NOT NULL,
          cantidad INTEGER NOT NULL,
          id_jugador INTEGER,
          notas TEXT,
          fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_item) REFERENCES inventario_items(id),
          FOREIGN KEY (id_jugador) REFERENCES jugadores(id)
      )
    `);

    // Tabla Gastos
    await client.execute(`
      CREATE TABLE IF NOT EXISTS gastos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          concepto TEXT NOT NULL,
          monto INTEGER NOT NULL,
          fecha_gasto DATE NOT NULL,
          categoria TEXT,
          notas TEXT,
          fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla Asistencias
    await client.execute(`
      CREATE TABLE IF NOT EXISTS asistencias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          id_jugador INTEGER,
          fecha DATE NOT NULL,
          estado TEXT NOT NULL, -- 'P' o 'A'
          fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Configuración Inicial
    const conf = await client.execute("SELECT * FROM configuracion_sistema WHERE id = 1");
    if (conf.rows.length === 0) {
        await client.execute("INSERT INTO configuracion_sistema (id, valor_mensual, nombre_escuela, moneda) VALUES (1, 50000, 'Academia Fútbol Pro', 'COP')");
    }

    console.log("✅ Base de datos lista y tablas verificadas.");
  } catch (error) {
    console.error("❌ Error inicializando DB:", error);
  }
};