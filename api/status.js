// Vercel Serverless Function: GET /api/status?id=...&reference=...
export default async function handler(req, res) {
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({success:false,error:'Use GET.'}); }
  const key = process.env.FLEVO_API_KEY;
  if (!key) return res.status(500).json({success:false,error:'Configure FLEVO_API_KEY nas variáveis da Vercel.'});
  const id = String(req.query.id || '');
  const reference = String(req.query.reference || '');
  if (!id && !reference) return res.status(400).json({success:false,error:'Informe id ou reference.'});
  const base = (process.env.FLEVO_API_BASE || 'https://app.flevopag.com/api/v1').replace(/\/$/,'');
  async function query(q) {
    const r = await fetch(`${base}/query?${q}`, {headers:{'X-API-Key':key,'Accept':'application/json'}});
    const text = await r.text(); let body; try { body=JSON.parse(text); } catch { body=null; }
    return {ok:r.ok,body};
  }
  try {
    let result = null;
    if (id) { const r=await query('action=get_transaction&id='+encodeURIComponent(id)); if(r.ok && r.body?.status) result=r.body; }
    if (!result && reference) {
      const r=await query('action=list_transactions&external_id='+encodeURIComponent(reference));
      if(r.ok && Array.isArray(r.body)) result=r.body[0] || null;
      else if(r.ok && r.body?.status) result=r.body;
    }
    if (!result) return res.status(200).json({success:true,status:'PENDING',id:id || null});
    const raw=String(result.status || result.payment_status || 'pending').toLowerCase();
    const map={approved:'APPROVED',paid:'APPROVED',completed:'APPROVED',confirmed:'APPROVED',pending:'PENDING',waiting:'PENDING',created:'PENDING',expired:'EXPIRED',canceled:'CANCELED',cancelled:'CANCELED',failed:'FAILED',refused:'FAILED',refunded:'REFUNDED'};
    return res.status(200).json({success:true,status:map[raw] || raw.toUpperCase(),amount:result.amount ?? null,id:result.id ?? result.transaction_id ?? id});
  } catch(e) { console.error('PIX status error:',e); return res.status(502).json({success:false,error:'Não foi possível consultar o status do pagamento.'}); }
}
