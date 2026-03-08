"""
Conexão com o cluster BancoFinancia no Atlas.
Expõe a variável db para o resto da aplicação usar as coleções pessoas e modelos.
"""
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Connection String do Atlas (senha via variável de ambiente por segurança)
MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://sergiosoares0226_db_user:<db_password>@bancofinancia.gx8bslt.mongodb.net/?retryWrites=true&w=majority&appName=BancoFinancia"
).replace("<db_password>", os.getenv("MONGODB_PASSWORD", ""))

client = AsyncIOMotorClient(MONGODB_URI)
db = client.alinhave  # banco "alinhave"

# Coleções usadas pela aplicação
# db.pessoas  -> cadastro de pessoas
# db.modelos  -> templates .docx (nome, data, binário)
