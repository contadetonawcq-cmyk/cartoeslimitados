// Vercel Serverless Function: POST /api/pix
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, error: 'Método não permitido. Use POST.' });
  }
  const key = process.env.FLEVO_API_KEY;
  if (!key) return res.status(500).json({success:false,error:'Configure a variável FLEVO_API_KEY nas Environment Variables da Vercel.'});
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const amount = Number(data.amount);
    if (!Number.isInteger(amount) || amount < 100) return res.status(400).json({success:false,error:'Informe o valor em centavos. O mínimo é R$ 1,00.'});
    const name = String(data.payerName || data.name || '').trim();
    const email = String(data.email || '').trim();
    const phone = String(data.phone || '').replace(/\D/g,'');
    const document = String(data.document || data.cpf || '').replace(/\D/g,'');
    if (!name || !email || phone.length < 10 || ![11,14].includes(document.length))
      return res.status(400).json({success:false,error:'Confira nome, e-mail, telefone com DDD e CPF/CNPJ.'});
    const reference = `APPLE-${Date.now()}-${Math.random().toString(16).slice(2,10)}`;
    const payload = { amount, description: String(data.productName || 'Apple Card - Envio'), reference, source:'api_externa',
      customer:{name,email,phone,document} };
    // A documentação permite productHash como obrigatório, exceto quando source = api_externa.
    // Se configurado, enviamos o hash do produto para associar a transação ao produto no painel.
    if (process.env.FLEVO_PRODUCT_HASH) payload.productHash = process.env.FLEVO_PRODUCT_HASH;
    const utm = data.utm && typeof data.utm === 'object' ? data.utm : {};
    const tracking = {};
    for (const k of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck'])
      if (typeof utm[k] === 'string' && utm[k].trim()) tracking[k] = utm[k].trim();
    if (Object.keys(tracking).length) payload.tracking = tracking;
    const base = process.env.FLEVO_API_BASE || 'https://app.flevopag.com/api/v1';
    const r = await fetch(base.replace(/\/$/,'') + '/transaction', {
      method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json','X-API-Key':key},
      body:JSON.stringify(payload)
    });
    const raw = await r.text();
    let result; try { result = JSON.parse(raw); } catch { result = null; }
    if (!r.ok) return res.status(502).json({success:false,error:result?.message || result?.error || `Gateway recusou a solicitação (HTTP ${r.status}).`});
    if (!result) return res.status(502).json({success:false,error:'O gateway retornou uma resposta inválida.'});
    const pixCopyPaste = result.qr_code || result.pix_code || result.pixCopyPaste || result.emv || '';
    const qrCodeImage = result.qr_code_base64 || result.qrCodeImage || '';
    const transactionId = result.transaction_id ?? result.id;
    if (!pixCopyPaste && !qrCodeImage) return res.status(502).json({success:false,error:'Gateway não retornou o QR Code nem o código Pix.'});
    return res.status(200).json({success:true,transactionId,id:transactionId,reference:result.id || reference,qrCodeImage,pixCopyPaste,amount:result.amount ?? amount});
  } catch (e) {
    console.error('PIX create error:', e);
    return res.status(500).json({success:false,error:'Erro interno ao gerar Pix. Confira as configurações da Vercel.'});
  }
}
