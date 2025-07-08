const express = require("express");
const path = require("path");
const app = express();
const db = require("./db");
const cors = require("cors");

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const users = [];

// Registrasi
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;

  try {
    const existing = db
      .prepare("SELECT * FROM pasien WHERE username = ?")
      .get(username);

    if (existing) {
      return res.status(400).json({ message: "Username sudah terdaftar" });
    }

    db.prepare("INSERT INTO pasien (username, password) VALUES (?, ?)").run(
      username,
      password
    );

    res.json({ message: "Registrasi berhasil" });
  } catch (err) {
    res.status(500).json({ message: "Gagal registrasi", error: err.message });
  }
});

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  try {
    const user = db
      .prepare("SELECT * FROM pasien WHERE username = ? AND password = ?")
      .get(username, password);

    if (!user) {
      return res.status(401).json({ message: "Username atau password salah" });
    }

    res.json({ message: "Login berhasil", token: "fake-jwt-token" }); // opsional token
  } catch (err) {
    res.status(500).json({ message: "Gagal login", error: err.message });
  }
});

// ============================================
// ✅ ADMIN ENDPOINT UNTUK DOKTER DAN JADWAL
// ============================================

// GET semua dokter
app.get("/api/doctors", (req, res) => {
  try {
    const doctors = db.prepare("SELECT * FROM dokter").all();
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil daftar dokter" });
  }
});

// POST tambah dokter baru
app.post("/api/doctors", (req, res) => {
  try {
    const { nama, poli } = req.body;
    if (!nama || !poli) {
      return res.status(400).json({ error: "Nama dan poli wajib diisi" });
    }

    const stmt = db.prepare("INSERT INTO dokter (nama, poli) VALUES (?, ?)");
    const result = stmt.run(nama, poli);

    res.json({ id: result.lastInsertRowid, nama, poli });
  } catch (err) {
    res.status(500).json({ error: "Gagal menambahkan dokter" });
  }
});

// GET jadwal dokter berdasarkan ID dokter
app.get("/api/doctors/:id/schedules", (req, res) => {
  try {
    const id = req.params.id;
    const stmt = db.prepare(`
      SELECT hari, shift 
      FROM jadwal_dokter 
      WHERE dokter_id = ?
    `);
    const rows = stmt.all(id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil jadwal dokter" });
  }
});

// POST tambah jadwal dokter
app.post("/api/doctors/:id/schedules", (req, res) => {
  try {
    const id = req.params.id;
    const { hari, shift } = req.body;

    if (!hari || !shift) {
      return res.status(400).json({ error: "Hari dan shift wajib diisi" });
    }

    const cek = db
      .prepare(
        `
      SELECT * FROM jadwal_dokter WHERE dokter_id = ? AND hari = ?
    `
      )
      .get(id, hari);

    if (cek) {
      // Update jika sudah ada jadwal untuk hari tersebut
      db.prepare(
        `
        UPDATE jadwal_dokter SET shift = ? WHERE dokter_id = ? AND hari = ?
      `
      ).run(shift, id, hari);
    } else {
      // Insert baru
      db.prepare(
        `
        INSERT INTO jadwal_dokter (dokter_id, hari, shift) VALUES (?, ?, ?)
      `
      ).run(id, hari, shift);
    }

    res.json({ message: "Jadwal berhasil disimpan" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan jadwal" });
  }
});

// ============================================
// Endpoint untuk pasien (dengan filter poli & hari)
app.get("/api/dokter", (req, res) => {
  try {
    const { poli, hari } = req.query;

    if (!poli || !hari) {
      return res
        .status(400)
        .json({ error: "Parameter 'poli' dan 'hari' diperlukan" });
    }

    const stmt = db.prepare(`
      SELECT 
        d.id, 
        d.nama AS Nama, 
        jd.shift AS Shift
      FROM dokter d
      JOIN jadwal_dokter jd ON d.id = jd.dokter_id
      WHERE d.poli = ?
      AND jd.hari = ?
    `);

    const rows = stmt.all(poli, hari);
    res.json(rows);
  } catch (error) {
    console.error("Gagal ambil data dokter:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Endpoint alternatif melihat seluruh jadwal dokter
app.get("/api/jadwal-dokter", (req, res) => {
  try {
    const query = `
      SELECT 
        d.id AS dokter_id,
        d.nama,
        d.poli,
        jd.hari,
        jd.shift
      FROM dokter d
      JOIN jadwal_dokter jd ON d.id = jd.dokter_id
      ORDER BY d.id, jd.hari
    `;
    const rows = db.prepare(query).all();

    const hasil = [];

    for (const row of rows) {
      let dokter = hasil.find((d) => d.nama === row.nama);
      if (!dokter) {
        dokter = {
          nama: row.nama,
          poli: row.poli,
          jadwal: [],
        };
        hasil.push(dokter);
      }

      dokter.jadwal.push({
        hari: row.hari,
        shift: row.shift,
      });
    }

    res.json(hasil);
  } catch (err) {
    console.error("Gagal ambil jadwal dokter:", err.message);
    res.status(500).json({ error: "Gagal mengambil jadwal dokter" });
  }
});

/* obat */
app.get("/api/obat", (req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM obat").all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data obat" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log("Server running on http://localhost:" + PORT)
);
