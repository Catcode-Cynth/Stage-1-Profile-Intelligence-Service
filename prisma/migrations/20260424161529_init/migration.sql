-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT,
    "gender_probability" DOUBLE PRECISION,
    "sample_size" INTEGER,
    "age" INTEGER,
    "age_group" TEXT,
    "country_id" TEXT,
    "country_probability" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_name_key" ON "profiles"("name");
