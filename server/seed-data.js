#!/usr/bin/env node
/**
 * Kitap veritabanını 200+ kitap ile doldurur.
 * Kullanım: node server/seed-data.js [--force]
 */
const db = require('./db');
const { seedBooks } = require('./seed-books');

const force = process.argv.includes('--force');
seedBooks(db, { force });
const categories = db.prepare('SELECT DISTINCT kategori, COUNT(*) as sayi FROM books GROUP BY kategori ORDER BY kategori').all();
console.log('\nKategoriler:');
categories.forEach((c) => console.log(`  ${c.kategori}: ${c.sayi} kitap`));
