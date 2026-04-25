import express from "express";
import cors from "cors";
import axios from "axios";
import { v7 as uuidv7 } from "uuid";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const app = express();
const prisma = new PrismaClient();

app.use(cors({ origin: "*" }));
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ status: "API is running" });
});

const getAgeGroup = (age) => {
  if (age <= 12) return "child";
  if (age <= 19) return "teenager";
  if (age <= 59) return "adult";
  return "senior";
};

// POST /api/profiles
app.post("/api/profiles", async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({
      status: "error",
      message: "Name is required and must be a non-empty string",
    });
  }

  const cleanName = name.trim().toLowerCase();

  try {
    const existing = await prisma.profile.findUnique({
      where: { name: cleanName },
    });

    if (existing) {
      return res.status(200).json({
        status: "success",
        message: "Profile already exists",
        data: existing,
      });
    }

    const [genderRes, ageRes, nationRes] = await Promise.all([
      axios.get(`https://api.genderize.io?name=${cleanName}`),
      axios.get(`https://api.agify.io?name=${cleanName}`),
      axios.get(`https://api.nationalize.io?name=${cleanName}`),
    ]);

    const g = genderRes.data;
    const a = ageRes.data;
    const n = nationRes.data;

    if (!g.gender || g.count === 0) {
      return res.status(502).json({
        status: "error",
        message: "Genderize returned an invalid response",
      });
    }

    if (a.age === null) {
      return res.status(502).json({
        status: "error",
        message: "Agify returned an invalid response",
      });
    }

    if (!n.country || n.country.length === 0) {
      return res.status(502).json({
        status: "error",
        message: "Nationalize returned an invalid response",
      });
    }

    const bestCountry = n.country.reduce((prev, curr) =>
      prev.probability > curr.probability ? prev : curr
    );

    const profile = await prisma.profile.create({
      data: {
        id: uuidv7(),
        name: cleanName,
        gender: g.gender,
        gender_probability: g.probability,
        sample_size: g.count,
        age: a.age,
        age_group: getAgeGroup(a.age),
        country_id: bestCountry.country_id,
        country_probability: bestCountry.probability,
      },
    });

    res.status(201).json({ status: "success", data: profile });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});

// GET /api/profiles/:id
app.get("/api/profiles/:id", async (req, res) => {
  const profile = await prisma.profile.findUnique({
    where: { id: req.params.id },
  });

  if (!profile) {
    return res.status(404).json({
      status: "error",
      message: "Profile not found",
    });
  }

  res.json({ status: "success", data: profile });
});

// GET /api/profiles
app.get("/api/profiles", async (req, res) => {
  const { gender, country_id, age_group } = req.query;

  const where = {};
  if (gender) where.gender = gender.toLowerCase();
  if (country_id) where.country_id = country_id.toUpperCase();
  if (age_group) where.age_group = age_group.toLowerCase();

  const profiles = await prisma.profile.findMany({
    where,
    select: {
      id: true,
      name: true,
      gender: true,
      age: true,
      age_group: true,
      country_id: true,
    },
    orderBy: { created_at: "desc" },
  });

  res.json({
    status: "success",
    count: profiles.length,
    data: profiles,
  });
});

// DELETE /api/profiles/:id
app.delete("/api/profiles/:id", async (req, res) => {
  try {
    await prisma.profile.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({
        status: "error",
        message: "Profile not found",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
});


export default app;