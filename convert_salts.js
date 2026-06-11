const salts = {
  "124@comunapasofrente.com": "SscIIOJthhy1RA==",
  "123@comunapasofrente.com": "2xVGibp3XzQUWQ==",
  "123@comunapasofrente.local": "jtnc8EDAiyMfmw==",
  "joyvert.albero23@gmail.com": "kWK6W8K+tvk6mg==",
  "temp_reset_user@comunapasofrente.com": "XvWW5Jhys76cpQ=="
};

for (const [email, b64] of Object.entries(salts)) {
  const hex = Buffer.from(b64, 'base64').toString('hex');
  console.log(`"${email}": "${hex}",`);
}
