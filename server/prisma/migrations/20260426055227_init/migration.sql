-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "activationTokenId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "roles" TEXT[] DEFAULT ARRAY['STAFF']::TEXT[],
    "phones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mfaSecret" TEXT,
    "mfaUri" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserName" (
    "id" TEXT NOT NULL,
    "fName" TEXT,
    "mName" TEXT,
    "lName" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "UserName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "street" TEXT,
    "suburb" TEXT,
    "post" TEXT,
    "city" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_activationTokenId_key" ON "User"("activationTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "UserName_userId_key" ON "UserName"("userId");

-- AddForeignKey
ALTER TABLE "UserName" ADD CONSTRAINT "UserName_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
