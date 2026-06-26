'use strict';

// ══════════════════════════════════════════════
//  SEGURIDAD
// ══════════════════════════════════════════════
const Seguridad = {
  limpiar(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>&"'`\/\\]/g,'').replace(/javascript:/gi,'').replace(/on\w+=/gi,'').trim().slice(0,200);
  },
  limpiarNumero(val) {
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0 || n > 9_999_999) return null;
    return Math.round(n * 100) / 100;
  },
  limpiarFecha(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const d = new Date(str + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    if (y < 2000 || y > 2100) return null;
    return str;
  },
  limpiarEmoji(str) { return str.trim().slice(0,2); }
};

// ══════════════════════════════════════════════
//  STORE
// ══════════════════════════════════════════════
const Store = {
  K_TRANS:  'mf_trans_v3',
  K_METAS:  'mf_metas_v3',
  K_CONFIG: 'mf_config_v3',
  K_HIST:   'mf_historial_v3',
  K_SAPL:   'mf_sueldo_aplicado_v3',

  _r(k,d){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):d; }catch{ return d; } },
  _w(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch{ return false; } },

  getTrans()   { return this._r(this.K_TRANS,[]); },
  setTrans(a)  { return this._w(this.K_TRANS,a); },
  addTrans(t)  { const a=this.getTrans(); a.push(t); return this.setTrans(a); },
  delTrans(id) { return this.setTrans(this.getTrans().filter(t=>t.id!==id)); },

  getMetas()   { return this._r(this.K_METAS,[]); },
  setMetas(a)  { return this._w(this.K_METAS,a); },

  getConfig()  { return this._r(this.K_CONFIG,{nombre:'',tema:'verde',oscuro:false,sueldo:0,diaSueldo:1,sueldoActivo:false}); },
  setConfig(c) { return this._w(this.K_CONFIG,c); },

  getHistorial()   { return this._r(this.K_HIST,[]); },
  setHistorial(a)  { return this._w(this.K_HIST,a); },
  delHistorialMes(clave){ return this.setHistorial(this.getHistorial().filter(h=>h.claveMes!==clave)); },

  getSApl()    { return this._r(this.K_SAPL,[]); },
  setSApl(a)   { return this._w(this.K_SAPL,a); },

  cerrarMes(mes,anio) {
    const clave=`${anio}-${String(mes+1).padStart(2,'0')}`;
    const trans=this.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mes&&+y===anio; });
    if(!trans.length) return false;
    const hist=this.getHistorial();
    if(hist.find(h=>h.claveMes===clave)) return false;
    hist.unshift({claveMes:clave,nombre:Fmt.nombreMes(mes,anio),transacciones:trans,fechaCierre:new Date().toISOString()});
    this.setHistorial(hist);
    this.setTrans(this.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return!(+m-1===mes&&+y===anio); }));
    return true;
  },

  borrarTodo() {
    [this.K_TRANS,this.K_METAS,this.K_CONFIG,this.K_HIST,this.K_SAPL,this.K_RECUR,this.K_PEND,this.K_TARJETAS,this.K_LIMITE,this.K_PRESUP].forEach(k=>localStorage.removeItem(k));
  },

  // Recurrentes: [{id, descripcion, monto, categoria, dia, activo}]
  K_TARJETAS: 'mf_tarjetas_v1',
  K_LIMITE:   'mf_limite_v1',
  K_RECUR: 'mf_recurrentes_v1',
  K_PRESUP: 'mf_presupuesto_v1',
  getTarjetas()   { return this._r(this.K_TARJETAS, []); },
  setTarjetas(a)  { return this._w(this.K_TARJETAS, a); },
  getLimite()     { return this._r(this.K_LIMITE, {monto:0}); },
  setLimite(o)    { return this._w(this.K_LIMITE, o); },
  getRecurrentes()  { return this._r(this.K_RECUR, []); },
  setRecurrentes(a) { return this._w(this.K_RECUR, a); },
  getPresupuesto()  { return this._r(this.K_PRESUP, {nombre:'',ingreso:0,fijos:[],variables:[],extras:[]}); },
  setPresupuesto(p) { return this._w(this.K_PRESUP, p); },

  // Pendientes del mes: [{id, descripcion, monto, categoria, fechaVence, pagado, recurrenteId?}]
  K_PEND: 'mf_pendientes_v1',
  getPendientes()   { return this._r(this.K_PEND, []); },
  setPendientes(a)  { return this._w(this.K_PEND, a); },

  // Genera pendientes del mes actual a partir de recurrentes
  generarPendientesMes() {
    const hoy = new Date();
    const mes = hoy.getMonth(), anio = hoy.getFullYear();
    const claveMes = `${anio}-${String(mes+1).padStart(2,'0')}`;
    const recurrentes = this.getRecurrentes().filter(r => r.activo);
    const pendientes  = this.getPendientes();

    recurrentes.forEach(r => {
      // Verificar si ya existe pendiente (pagado o no) O si ya hay transacción de gasto
      // con el mismo nombre/categoría en este mes generada desde este recurrente
      const yaExistePend = pendientes.some(p =>
        p.recurrenteId === r.id && p.claveMes === claveMes
      );
      // También verificar si ya hay transacción real de este servicio pagada este mes
      const yaExisteTrans = this.getTrans().some(t => {
        const [y,m] = t.fecha.split('-');
        return t.tipo==='gasto' && t.descripcion===r.descripcion &&
               t.categoria===r.categoria && +m-1===mes && +y===anio &&
               (t.nota==='Pago de pendiente' || t.nota==='Pago automático');
      });
      if (!yaExistePend && !yaExisteTrans) {
        const dia = Math.min(r.dia || 1, 28);
        pendientes.push({
          id: 'pend_' + r.id + '_' + claveMes,
          recurrenteId: r.id,
          claveMes,
          descripcion: r.descripcion,
          monto: r.monto,
          categoria: r.categoria,
          fechaVence: `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`,
          pagado: false,
          prioridad: r.prioridad || false
        });
      }
    });
    this.setPendientes(pendientes);
  }
};


// ══════════════════════════════════════════════
//  AUTO-RECONOCIMIENTO DE CATEGORÍAS
// ══════════════════════════════════════════════
const AutoCat = {
  reglas: [
    // Comida
    { palabras: ['almuerzo','comida','cena','desayuno','hamburguesa','pizza','pollo','tacos','sushi','cafe','café','restaurante','cafetería','cafeteria','lunch','snack','helado','pan','tortilla','pupusa','sandwich','burrito','pasta','sopa','ensalada','mariscos','san martin','taco bell'], cat: 'comida' },
    // Transporte
    { palabras: ['gasolina','combustible','uber','taxi','bus','transporte','parqueo','parking','peaje','moto','gasolinera','boleto','pasaje','metro','tren','aerolinea','vuelo','avion'], cat: 'transporte' },
    // Supermercado
    { palabras: ['super','supermercado','walmart','despensa','mercado','groceries','compras','verduras','frutas','carnicería','carniceria','panadería','panaderia'], cat: 'supermercado' },
    // Salud
    { palabras: ['farmacia','medicina','medicamento','doctor','médico','medico','hospital','clínica','clinica','dental','dentista','vitamina','pastilla','consulta','laboratorio','examen','salud'], cat: 'salud' },
    // Servicios
    { palabras: ['luz','electricidad','agua','internet','wifi','telefono','teléfono','celular','cable','netflix','spotify','streaming','suscripcion','suscripción','seguro','renta','alquiler','gas','recibo','factura'], cat: 'servicios' },
    // Ocio
    { palabras: ['cine','película','pelicula','concierto','teatro','entretenimiento','juego','videojuego','gym','gimnasio','deporte','hobby','vacacion','vacaciones','tour','paseo','fiesta'], cat: 'ocio' },
    // Ropa
    { palabras: ['ropa','zapatos','camisa','pantalon','vestido','calzado','blusa','sueter','gorra','tienda','zapatería','zapateria','accesorio'], cat: 'ropa' },
    // Educación
    { palabras: ['colegio','universidad','curso','libro','escuela','educacion','educación','matrícula','matricula','útiles','utiles','tutoría','tutoria','clase','capacitacion','capacitación'], cat: 'educacion' },
    // Hogar
    { palabras: ['hogar','casa','mueble','decoracion','decoración','limpieza','detergente','jabon','jab','mantenimiento','reparacion','reparación','ferretería','ferreteria','electrodoméstico','electrodomestico','microondas','refri','tele','cloro'], cat: 'hogar' },
  ],

  detectar(texto) {
    if (!texto || texto.length < 2) return null;
    const t = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const regla of this.reglas) {
      if (regla.palabras.some(p => t.includes(p))) return regla.cat;
    }
    return null;
  }
};

// ══════════════════════════════════════════════
//  CATEGORÍAS
// ══════════════════════════════════════════════
const CATS = {
  gasto: [
    {id:'comida',nombre:'Comida',emoji:'🍽️'},
    {id:'transporte',nombre:'Transporte',emoji:'🚗'},
    {id:'supermercado',nombre:'Súper',emoji:'🛒'},
    {id:'salud',nombre:'Salud',emoji:'💊'},
    {id:'ocio',nombre:'Ocio',emoji:'🎬'},
    {id:'servicios',nombre:'Servicios',emoji:'💡'},
    {id:'ropa',nombre:'Ropa',emoji:'👕'},
    {id:'educacion',nombre:'Educación',emoji:'📚'},
    {id:'hogar',nombre:'Hogar',emoji:'🏠'},
    {id:'metas_gasto',nombre:'Metas',emoji:'🎯'},
    {id:'otros_g',nombre:'Otros',emoji:'📦'},
  ],
  ingreso: [
    {id:'salario',nombre:'Salario',emoji:'💼'},
    {id:'freelance',nombre:'Freelance',emoji:'💻'},
    {id:'negocio',nombre:'Negocio',emoji:'🏪'},
    {id:'inversion',nombre:'Inversión',emoji:'📈'},
    {id:'regalo',nombre:'Regalo',emoji:'🎁'},
    {id:'otros_i',nombre:'Otros',emoji:'✨'},
  ]
};
function getCat(id){ return [...CATS.gasto,...CATS.ingreso].find(c=>c.id===id)||{id:'otros_g',nombre:'Otro',emoji:'📦'}; }

// ══════════════════════════════════════════════
//  FORMATO
// ══════════════════════════════════════════════
const Fmt = {
  monto(n){ return 'Q '+Math.abs(n).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2}); },
  nombreMes(mes,anio){ return new Date(anio,mes,1).toLocaleDateString('es-GT',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase()); },
  fechaCorta(iso){
    const[y,m,d]=iso.split('-'); const f=new Date(+y,+m-1,+d);
    const hoy=new Date(),ayer=new Date(hoy); ayer.setDate(ayer.getDate()-1);
    if(f.toDateString()===hoy.toDateString()) return 'Hoy';
    if(f.toDateString()===ayer.toDateString()) return 'Ayer';
    return f.toLocaleDateString('es-GT',{day:'numeric',month:'short'});
  },
  fechaGrupo(iso){
    const[y,m,d]=iso.split('-'); const f=new Date(+y,+m-1,+d);
    const hoy=new Date(),ayer=new Date(hoy); ayer.setDate(ayer.getDate()-1);
    if(f.toDateString()===hoy.toDateString()) return 'Hoy';
    if(f.toDateString()===ayer.toDateString()) return 'Ayer';
    return f.toLocaleDateString('es-GT',{weekday:'long',day:'numeric',month:'long'}).replace(/^./,c=>c.toUpperCase());
  }
};

// ══════════════════════════════════════════════
//  SUELDO AUTOMÁTICO
// ══════════════════════════════════════════════
const Sueldo = {
  clavesMes(mes,anio){ return `${anio}-${String(mes+1).padStart(2,'0')}`; },
  yaAplicado(mes,anio){ return Store.getSApl().includes(this.clavesMes(mes,anio)); },
  marcarAplicado(mes,anio){
    const arr=Store.getSApl(), k=this.clavesMes(mes,anio);
    if(!arr.includes(k)){ arr.push(k); Store.setSApl(arr); }
  },
  verificarYAplicar(){
    const cfg=Store.getConfig();
    if(!cfg.sueldoActivo||!cfg.sueldo) return false;
    const hoy=new Date(), mes=hoy.getMonth(), anio=hoy.getFullYear(), dia=hoy.getDate();
    if(dia<(cfg.diaSueldo||1)) return false;
    if(this.yaAplicado(mes,anio)) return false;
    const t={
      id:'sueldo_'+this.clavesMes(mes,anio),
      tipo:'ingreso', descripcion:'Sueldo mensual', monto:cfg.sueldo,
      categoria:'salario',
      fecha:`${anio}-${String(mes+1).padStart(2,'0')}-${String(cfg.diaSueldo||1).padStart(2,'0')}`,
      nota:'Automático', automatico:true
    };
    Store.addTrans(t);
    this.marcarAplicado(mes,anio);
    return true;
  }
};

// ══════════════════════════════════════════════
//  PDF
// ══════════════════════════════════════════════
const PDF = {
  generar(entrada){
    const trans=entrada.transacciones||entrada.trans||[];
    const titulo=entrada.nombre||Fmt.nombreMes(mesActual,anioActual);
    const cfg=Store.getConfig();
    const ingresos=trans.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
    const gastos=trans.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
    const saldo=ingresos-gastos;
    const porCat={};
    trans.filter(t=>t.tipo==='gasto').forEach(t=>{ porCat[t.categoria]=(porCat[t.categoria]||0)+t.monto; });
    const totalGastos=gastos||1;
    const colores=['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0d9488','#ca8a04','#dc2626','#0891b2','#9333ea'];
    const catEntradas=Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    const barrasHTML=catEntradas.map(([id,total],i)=>{
      const cat=getCat(id); const pct=Math.round((total/totalGastos)*100); const color=colores[i%colores.length];
      return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px"><span>${cat.emoji} ${cat.nombre}</span><span style="font-weight:600">${Fmt.monto(total)} <span style="color:#64748b;font-weight:400">(${pct}%)</span></span></div><div style="background:#e2e8f0;border-radius:4px;height:10px;overflow:hidden"><div style="width:${pct}%;background:${color};height:100%;border-radius:4px"></div></div></div>`;
    }).join('');
    const sorted=[...trans].sort((a,b)=>b.fecha.localeCompare(a.fecha));
    const transHTML=sorted.map(t=>{
      const cat=getCat(t.categoria); const ing=t.tipo==='ingreso';
      const nota=t.nota?`<br><span style="font-size:11px;color:#94a3b8">${Seguridad.limpiar(t.nota)}</span>`:'';
      return `<tr><td style="padding:8px 6px;color:#475569;font-size:12px">${t.fecha}</td><td style="padding:8px 6px">${cat.emoji} ${Seguridad.limpiar(t.descripcion)}${nota}</td><td style="padding:8px 6px;color:#475569;font-size:12px">${cat.nombre}</td><td style="padding:8px 6px;text-align:right;font-weight:700;color:${ing?'#16a34a':'#dc2626'}">${ing?'+':'-'}${Fmt.monto(t.monto)}</td></tr>`;
    }).join('');
    const fechaGen=new Date().toLocaleDateString('es-GT',{day:'numeric',month:'long',year:'numeric'});
    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Reporte ${titulo}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#fff;padding:32px;max-width:800px;margin:0 auto}@media print{body{padding:16px}.no-print{display:none!important}@page{margin:1.5cm}}h1{font-size:24px;font-weight:800;margin-bottom:4px}h2{font-size:15px;font-weight:600;margin:24px 0 12px;color:#1e293b;padding-bottom:6px;border-bottom:2px solid #e2e8f0}.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:20px;border-bottom:3px solid #16a34a}.resumen{display:flex;gap:12px;margin-bottom:24px}.resumen-card{flex:1;padding:16px;border-radius:12px;text-align:center}.resumen-card .label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px}.resumen-card .valor{font-size:20px;font-weight:800}.card-ing{background:#dcfce7}.card-ing .label{color:#166534}.card-ing .valor{color:#16a34a}.card-gas{background:#fee2e2}.card-gas .label{color:#7f1d1d}.card-gas .valor{color:#dc2626}.card-sal{background:#f1f5f9}.card-sal .label{color:#475569}.card-sal .valor{color:${saldo>=0?'#16a34a':'#dc2626'}}table{width:100%;border-collapse:collapse;font-size:13px}th{background:#f8fafc;text-align:left;padding:10px 6px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;border-bottom:1px solid #e2e8f0}tr:nth-child(even){background:#f8fafc}.btn-imprimir{display:block;margin:0 auto 24px;padding:12px 32px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer}</style></head><body><button class="btn-imprimir no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button><div class="header"><div><p style="font-size:12px;color:#64748b;margin-bottom:4px">MIS FINANZAS · REPORTE MENSUAL</p><h1>${titulo}</h1><p style="font-size:13px;color:#64748b;margin-top:4px">Usuario: ${Seguridad.limpiar(cfg.nombre)||'Mi Cuenta'}</p></div><div style="text-align:right;font-size:12px;color:#94a3b8"><p>Generado el</p><p style="font-weight:600;color:#475569">${fechaGen}</p><p style="margin-top:4px">${trans.length} movimientos</p></div></div><div class="resumen"><div class="resumen-card card-ing"><div class="label">💰 Ingresos</div><div class="valor">${Fmt.monto(ingresos)}</div></div><div class="resumen-card card-gas"><div class="label">💸 Gastos</div><div class="valor">${Fmt.monto(gastos)}</div></div><div class="resumen-card card-sal"><div class="label">${saldo>=0?'✅':'⚠️'} Saldo</div><div class="valor">${Fmt.monto(saldo)}</div></div></div>${catEntradas.length?`<h2>Gastos por categoría</h2><div style="margin-bottom:24px">${barrasHTML}</div>`:''}<h2>Detalle de transacciones</h2><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead><tbody>${transHTML||'<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8">Sin transacciones</td></tr>'}</tbody></table><p style="margin-top:32px;font-size:11px;color:#94a3b8;text-align:center">Mis Finanzas · Datos guardados localmente en tu dispositivo</p></body></html>`;
    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=`Reporte_${titulo.replace(/\s/g,'_')}.html`; a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
};

// ══════════════════════════════════════════════
//  ESTADO
// ══════════════════════════════════════════════
let mesActual  = new Date().getMonth();
let chartInstancia = null; // instancia global de Chart.js
let anioActual = new Date().getFullYear();
let tipoModal  = 'gasto';
let filtroTipo = 'todas';
let metaAbonarId = null;

// ══════════════════════════════════════════════
//  UI
// ══════════════════════════════════════════════
const UI = {

  // ── Salario — lógica centralizada ────────────
  // Retorna el salario registrado en el mes actual (la transacción más reciente de categoría salario)
  _getSalarioActual() {
    const hoy=new Date(), mes=hoy.getMonth(), anio=hoy.getFullYear();
    const trans=Store.getTrans().filter(t=>{
      const[y,m]=t.fecha.split('-');
      return t.categoria==='salario' && t.tipo==='ingreso' && +m-1===mes && +y===anio;
    });
    if(!trans.length) return null;
    // La más reciente
    return trans.sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
  },

  // Actualiza el banner de salario en inicio
  _actualizarBannerSalario() {
    const banner=document.getElementById('banner-salario');
    const elMonto=document.getElementById('banner-sal-monto');
    if(!banner||!elMonto) return;
    const cfg=Store.getConfig();
    if(cfg.sueldo&&cfg.sueldo>0) {
      const autoStr=cfg.sueldoActivo?' · Auto ✓':'';
      elMonto.textContent=`${Fmt.monto(cfg.sueldo)} · Día ${cfg.diaSueldo}${autoStr}`;
      banner.style.display='flex';
    } else {
      banner.style.display='none';
    }
  },

  // ── Inicio ────────────────────────────────────
  renderInicio() {
    // Generar pendientes del mes si hay recurrentes
    Store.generarPendientesMes();

    const trans=Store.getTrans().filter(t=>{
      const[y,m]=t.fecha.split('-');
      return +m-1===mesActual&&+y===anioActual;
    });
    const ingresos=trans.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
    const gastos  =trans.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
    const saldo   =ingresos-gastos;

    const el=document.getElementById('saldo-principal');
    el.textContent = saldo<0 ? '-'+Fmt.monto(Math.abs(saldo)) : Fmt.monto(saldo);
    el.style.color = saldo<0 ? '#fca5a5' : '#fff';

    const card=document.getElementById('card-saldo-el');
    if(card) card.style.background = saldo<0 ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '';

    document.getElementById('mini-ingresos').textContent=Fmt.monto(ingresos);
    document.getElementById('mini-gastos').textContent  =Fmt.monto(gastos);

    const cfg=Store.getConfig();
    document.getElementById('nombre-usuario').textContent=Seguridad.limpiar(cfg.nombre)||'Mi Cuenta';

    this._actualizarBannerSalario();
    this._renderLimiteGlobal();   // banner rojo si límite excedido
    this._renderPendientesAlerta();
    this._renderChips(trans);
    this._renderRecientes(trans);
  },

  _renderPendientesAlerta() {
    const contenedor = document.getElementById('alertas-pendientes');
    if (!contenedor) return;

    const hoy = new Date();
    const mes  = hoy.getMonth(), anio = hoy.getFullYear();
    const claveMes = `${anio}-${String(mes+1).padStart(2,'0')}`;

    const pendientes = Store.getPendientes().filter(p =>
      p.claveMes === claveMes && !p.pagado
    );

    // También incluir transacciones con prioridad no pagadas
    const transPrioridad = Store.getTrans().filter(t => {
      const[y,m]=t.fecha.split('-');
      return t.prioridad && !t.pagado && +m-1===mes && +y===anio && t.tipo==='gasto';
    });

    const total = pendientes.length + transPrioridad.length;
    if (!total) { contenedor.style.display='none'; return; }
    contenedor.style.display = 'block';

    const itemsPend = pendientes.map(p => {
      const cat = getCat(p.categoria);
      const vence = new Date(p.fechaVence+'T00:00:00');
      const diasFaltan = Math.ceil((vence-hoy)/(1000*60*60*24));
      const urgente = diasFaltan <= 3;
      return `<div class="alerta-item ${urgente?'alerta-urgente':''}">
        <div class="alerta-ico">${cat.emoji}</div>
        <div class="alerta-info">
          <p class="alerta-desc">${Seguridad.limpiar(p.descripcion)}</p>
          <p class="alerta-sub">${urgente?'⚠️ Vence pronto':'Pendiente'} · ${Fmt.monto(p.monto)}</p>
        </div>
        <button class="alerta-pagar-btn" data-pend-id="${p.id}">Pagar</button>
      </div>`;
    }).join('');

    const itemsTrans = transPrioridad.map(t => {
      const cat = getCat(t.categoria);
      return `<div class="alerta-item alerta-prioridad">
        <div class="alerta-ico">${cat.emoji}</div>
        <div class="alerta-info">
          <p class="alerta-desc">${Seguridad.limpiar(t.descripcion)}</p>
          <p class="alerta-sub">Prioridad · ${Fmt.monto(t.monto)}</p>
        </div>
        <button class="alerta-pagar-btn" data-trans-id="${t.id}">✓</button>
      </div>`;
    }).join('');

    contenedor.innerHTML = `
      <div class="alertas-header">
        <span class="alertas-titulo">🔔 Pendientes (${total})</span>
        <button class="alertas-ver-todos" onclick="App.irA('transacciones')">Ver todos</button>
      </div>
      <div class="alertas-lista">${itemsPend}${itemsTrans}</div>`;

    // Bind botones pagar
    contenedor.querySelectorAll('[data-pend-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pendId = btn.dataset.pendId;
        // Primero leer el pendiente ANTES de mutar
        const pend = Store.getPendientes().find(p => p.id === pendId);
        if (!pend || pend.pagado) return; // ya pagado, ignorar
        // Marcar como pagado
        Store.setPendientes(Store.getPendientes().map(p =>
          p.id === pendId ? {...p, pagado:true} : p
        ));
        // Crear transacción real
        Store.addTrans({
          id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
          tipo:'gasto', descripcion:pend.descripcion, monto:pend.monto,
          categoria:pend.categoria, fecha:new Date().toISOString().slice(0,10),
          nota:'Pago de pendiente', pagado:true, prioridad:false
        });
        App.renderActual();
        this.toast('✓ Marcado como pagado');
      });
    });
    contenedor.querySelectorAll('[data-trans-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const todas = Store.getTrans().map(t =>
          t.id===btn.dataset.transId ? {...t,pagado:true,prioridad:false} : t
        );
        Store.setTrans(todas);
        App.renderActual();
        this.toast('✓ Marcado como pagado');
      });
    });
  },

  _renderChips(trans) {
    const el=document.getElementById('chips-categorias');
    const mapa={};
    trans.filter(t=>t.tipo==='gasto').forEach(t=>{ mapa[t.categoria]=(mapa[t.categoria]||0)+t.monto; });
    if(!Object.keys(mapa).length){ el.innerHTML='<p style="font-size:13px;color:var(--texto3);padding:4px 0">Sin gastos este mes</p>'; return; }
    el.innerHTML=Object.entries(mapa).sort((a,b)=>b[1]-a[1]).map(([id,total])=>{
      const cat=getCat(id);
      return `<div class="chip-cat"><span class="chip-emoji">${cat.emoji}</span><span class="chip-nombre">${cat.nombre}</span><span class="chip-monto">${Fmt.monto(total)}</span></div>`;
    }).join('');
  },

  _renderRecientes(trans) {
    const el=document.getElementById('lista-recientes');
    // Ordenar por fecha desc, y como desempate por id desc (más reciente primero)
    const rec=[...trans].sort((a,b)=>{
      const fechaDiff = b.fecha.localeCompare(a.fecha);
      if(fechaDiff !== 0) return fechaDiff;
      return b.id.localeCompare(a.id); // mismo día: el último agregado primero
    }).slice(0,5);
    if(!rec.length){ el.innerHTML=`<div class="estado-vacio"><div class="estado-vacio-ico">💸</div><p>Sin movimientos este mes</p><p>Toca <strong>+</strong> para agregar uno</p></div>`; return; }
    el.innerHTML=rec.map(t=>this._htmlTrans(t)).join('');
    this._bindDel(el);
  },

  _renderLimiteMensualEnMovimientos() {
    let el = document.getElementById('limite-movimientos-wrap');
    if(!el) return; // el div está en el HTML de Movimientos
    const lim = Store.getLimite();
    if(!lim.monto||lim.monto<=0){ el.style.display='none'; return; }
    const gastos = Store.getTrans().filter(t=>{
      const[y,m]=t.fecha.split('-');
      return t.tipo==='gasto'&&+m-1===mesActual&&+y===anioActual;
    }).reduce((s,t)=>s+t.monto,0);
    const pct  = Math.min(100,Math.round((gastos/lim.monto)*100));
    const disp = Math.max(0,lim.monto-gastos);
    const exc  = gastos>lim.monto;
    const color= exc?'#dc2626':pct>=80?'#f59e0b':'#16a34a';
    el.style.display='block';
    el.innerHTML=`<div class="limite-movimientos" style="border-color:${color}">
      <div class="lim-mov-header">
        <span class="lim-mov-titulo">💰 Límite mensual</span>
        <span class="lim-mov-pct" style="color:${color}">${pct}%</span>
      </div>
      <div class="limite-barra-bg" style="margin-bottom:6px"><div class="limite-barra-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="lim-mov-nums">
        <span>${Fmt.monto(gastos)} gastado</span>
        <span style="color:${color};font-weight:700">${exc?'⚠️ Excedido en '+Fmt.monto(gastos-lim.monto):'Disponible: '+Fmt.monto(disp)}</span>
      </div>
    </div>`;
  },

  // ── Gráfica SVG nativa (sin dependencias externas) ──────
  renderGrafica(trans, vista) {
    const wrap      = document.getElementById('grafica-wrap');
    const leyendaEl = document.getElementById('grafica-leyenda');
    const canvasWrap= document.querySelector('.grafica-contenedor');
    if(!wrap || !canvasWrap) return;

    const COLORES = ['#16a34a','#2563eb','#7c3aed','#db2777','#ea580c','#0d9488','#ca8a04','#dc2626','#0891b2','#9333ea','#65a30d','#d97706'];
    const gastos  = trans.filter(t => t.tipo === 'gasto');
    wrap.style.display = gastos.length ? 'block' : 'none';
    if(!gastos.length) { canvasWrap.innerHTML=''; leyendaEl.innerHTML=''; return; }

    const porCat  = {};
    gastos.forEach(t => { porCat[t.categoria] = (porCat[t.categoria]||0) + t.monto; });
    const entradas    = Object.entries(porCat).sort((a,b)=>b[1]-a[1]);
    const datos       = entradas.map(([,v]) => v);
    const colores     = entradas.map((_,i) => COLORES[i % COLORES.length]);
    const totalGastos = datos.reduce((s,v)=>s+v, 0);

    const esDark   = document.body.classList.contains('oscuro');
    const txtColor  = esDark ? '#e8edf5' : '#1e293b';
    const subColor  = esDark ? '#8896b0' : '#64748b';

    if(vista !== 'barras') {
      // ── Donut SVG mejorado ──
      const S=260, cx=S/2, cy=S/2, r=100, ri=62, gap=0.02;
      let paths='', a=-Math.PI/2;

      entradas.forEach(([,val],i) => {
        const frac = val/totalGastos;
        const sweep = frac * 2 * Math.PI - gap;
        const a2 = a + sweep;
        const lg = sweep > Math.PI ? 1 : 0;
        const cos1=Math.cos(a+gap/2), sin1=Math.sin(a+gap/2);
        const cos2=Math.cos(a2),      sin2=Math.sin(a2);
        const x1o=cx+r*cos1,  y1o=cy+r*sin1;
        const x2o=cx+r*cos2,  y2o=cy+r*sin2;
        const x1i=cx+ri*cos2, y1i=cy+ri*sin2;
        const x2i=cx+ri*cos1, y2i=cy+ri*sin1;
        paths += `<path d="M${x1o.toFixed(2)},${y1o.toFixed(2)} A${r},${r} 0 ${lg},1 ${x2o.toFixed(2)},${y2o.toFixed(2)} L${x1i.toFixed(2)},${y1i.toFixed(2)} A${ri},${ri} 0 ${lg},0 ${x2i.toFixed(2)},${y2i.toFixed(2)} Z" fill="${colores[i]}"><title>${getCat(entradas[i][0]).nombre}: ${Fmt.monto(val)}</title></path>`;
        a += frac * 2 * Math.PI;
      });

      canvasWrap.innerHTML = `
        <svg viewBox="0 0 ${S} ${S}" width="100%" style="max-width:260px;display:block;margin:0 auto">
          ${paths}
          <text x="${cx}" y="${cy-8}"  text-anchor="middle" font-size="12" fill="${subColor}" font-family="system-ui,sans-serif">Total gastos</text>
          <text x="${cx}" y="${cy+16}" text-anchor="middle" font-size="20" font-weight="800" fill="${txtColor}" font-family="system-ui,sans-serif">${Fmt.monto(totalGastos)}</text>
        </svg>`;

      leyendaEl.innerHTML = entradas.map(([id,total],i) => {
        const cat=getCat(id), pct=Math.round((total/totalGastos)*100);
        return `<div class="leyenda-item"><div class="leyenda-punto" style="background:${colores[i]}"></div><span>${cat.emoji} ${cat.nombre} <strong>${pct}%</strong></span></div>`;
      }).join('');

    } else {
      // ── Barras SVG ──
      const ingresos=trans.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
      const maxVal=Math.max(ingresos,totalGastos)||1;
      const W=320, H=180, padT=30, padB=40, padL=20, padR=20;
      const barW=80, espacio=(W-padL-padR-2*barW)/3;
      const alturaMax=H-padT-padB;
      const barras=[
        {label:'Ingresos',val:ingresos,color:'#16a34a'},
        {label:'Gastos',  val:totalGastos,color:'#dc2626'}
      ];
      const rects=barras.map((b,i)=>{
        const bH=Math.max(4,Math.round((b.val/maxVal)*alturaMax));
        const x=padL+espacio*(i+1)+barW*i;
        const y=padT+alturaMax-bH;
        const monto=Fmt.monto(b.val);
        return `<rect x="${x}" y="${y}" width="${barW}" height="${bH}" fill="${b.color}" rx="8" opacity="0.9"/>
<text x="${x+barW/2}" y="${y-8}" text-anchor="middle" font-size="11" font-weight="700" fill="${b.color}" font-family="system-ui">${monto}</text>
<text x="${x+barW/2}" y="${H-10}" text-anchor="middle" font-size="12" fill="${subColor}" font-family="system-ui">${b.label}</text>`;
      }).join('');
      // Línea base
      const lineaBase=`<line x1="${padL}" y1="${padT+alturaMax}" x2="${W-padR}" y2="${padT+alturaMax}" stroke="${esDark?'#1e2a3d':'#e2e8f0'}" stroke-width="1"/>`;
      canvasWrap.innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;margin:0 auto">${lineaBase}${rects}</svg>`;
      leyendaEl.innerHTML='';
    }
  },


  // ── Tarjetas ──────────────────────────────────────────
  TC_COLORES: ['#1a1a2e','#2563eb','#7c3aed','#db2777','#16a34a','#ea580c','#0d9488','#dc2626','#1e40af','#374151'],
  _tcColorSeleccionado: '#1a1a2e',

  renderTarjetas() {
    const el = document.getElementById('lista-tarjetas');
    const tarjetas = Store.getTarjetas();
    if(!tarjetas.length) {
      el.innerHTML=`<div class="estado-vacio"><div class="estado-vacio-ico">💳</div><p>Sin tarjetas configuradas</p><p>Toca <strong>+</strong> para agregar una</p></div>`;
      return;
    }
    const hoy=new Date(), mes=hoy.getMonth(), anio=hoy.getFullYear();

    // Limpiar contenedor y crear tarjetas como elementos DOM reales
    el.innerHTML = '';
    tarjetas.forEach(tc => {
      const usado = Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return t.tipo==='gasto'&&t.tarjetaId===tc.id&&+m-1===mes&&+y===anio; }).reduce((s,t)=>s+t.monto,0);
      const pct  = tc.limite ? Math.min(100,Math.round((usado/tc.limite)*100)) : 0;
      const disp = tc.limite ? Math.max(0,tc.limite-usado) : null;
      let estadoClass='tc-estado-ok', estadoTxt='OK';
      if(pct>=100){estadoClass='tc-estado-excedido';estadoTxt='EXCEDIDA';}
      else if(pct>=80){estadoClass='tc-estado-aviso';estadoTxt='⚠️ 80%';}

      const card = document.createElement('div');
      card.className = 'card-tc';
      card.style.background = `linear-gradient(135deg,${tc.color},${tc.color}cc)`;
      card.innerHTML = `
        <div class="tc-header">
          <div>
            <p class="tc-nombre">${Seguridad.limpiar(tc.nombre)}<span class="tc-estado ${estadoClass}">${estadoTxt}</span></p>
            <p class="tc-banco">${Seguridad.limpiar(tc.banco||'')}</p>
          </div>
          <span class="tc-chip">💳</span>
        </div>
        <div class="tc-limite-info">
          <p class="tc-usado">${Fmt.monto(usado)}</p>
          <p class="tc-de">${tc.limite?`de ${Fmt.monto(tc.limite)} · Disponible: ${Fmt.monto(disp)}`:'Sin límite configurado'}</p>
        </div>
        ${tc.limite?`<div class="tc-barra-bg"><div class="tc-barra-fill" style="width:${pct}%"></div></div>`:''}
        <div class="tc-footer">
          <span class="tc-corte">${tc.corte?`Corte: día ${tc.corte}`:''}</span>
          <div class="tc-acciones">
            <button class="tc-btn btn-editar-tc">Editar</button>
            <button class="tc-btn tc-btn-del btn-eliminar-tc">Eliminar</button>
          </div>
        </div>`;

      // Listeners directos en el elemento DOM — no en HTML string
      card.querySelector('.btn-editar-tc').addEventListener('click', () => this._editarTarjeta(tc.id));
      card.querySelector('.btn-eliminar-tc').addEventListener('click', () => this._confirmarEliminarTarjeta(tc.id));

      el.appendChild(card);
    });
  },

  _editarTarjeta(id) {
    const tc = Store.getTarjetas().find(t=>t.id===id);
    if(tc) this.abrirModalTarjeta(tc);
  },

  _ejecutarEliminarTarjeta() {
    const modal = document.getElementById('modal-eliminar-tc');
    const id = modal?.dataset.tcId;
    if(!id) return;

    // 1. Pasar todos los gastos de esa tarjeta a efectivo (quitar tarjetaId)
    const todasTrans = Store.getTrans().map(t =>
      t.tarjetaId === id ? {...t, tarjetaId: ''} : t
    );
    Store.setTrans(todasTrans);

    // 2. También actualizar el historial archivado
    const hist = Store.getHistorial().map(h => ({
      ...h,
      transacciones: h.transacciones.map(t =>
        t.tarjetaId === id ? {...t, tarjetaId: ''} : t
      )
    }));
    Store.setHistorial(hist);

    // 3. Eliminar la tarjeta
    Store.setTarjetas(Store.getTarjetas().filter(t => t.id !== id));

    this.cerrarModal('modal-eliminar-tc');
    this.renderTarjetas();
    this._actualizarSelectorTarjeta();
    App.renderActual();
    this.toast('✓ Tarjeta eliminada — gastos pasaron a Efectivo');
  },

  _confirmarEliminarTarjeta(id) {
    const tc = Store.getTarjetas().find(t => t.id === id);
    if(!tc) return;

    const txtEl = document.getElementById('eliminar-tc-txt');
    if(txtEl) txtEl.innerHTML = `Estás por eliminar <strong>"${Seguridad.limpiar(tc.nombre)}"</strong>. Esta acción no se puede deshacer.`;

    const modal = document.getElementById('modal-eliminar-tc');
    if(modal) modal.dataset.tcId = id;

    // Bind botón confirmar (usar once para no acumular listeners)
    const btnSi = document.getElementById('btn-si-eliminar-tc');
    if(btnSi) {
      const handler = () => this._ejecutarEliminarTarjeta();
      btnSi.replaceWith(btnSi.cloneNode(true)); // limpiar listeners previos
      document.getElementById('btn-si-eliminar-tc').addEventListener('click', handler, {once: true});
    }

    this._abrirModal('modal-eliminar-tc');
  },

  _renderLimiteGlobal() {
    const hoy=new Date(),mes=hoy.getMonth(),anio=hoy.getFullYear();
    const totalGastado=Store.getTrans().filter(t=>{const[y,m]=t.fecha.split('-');return t.tipo==='gasto'&&+m-1===mes&&+y===anio;}).reduce((s,t)=>s+t.monto,0);
    const lim=Store.getLimite();
    const noConfig=document.getElementById('limite-no-config');
    const barraWrap=document.getElementById('limite-barra-wrap');
    if(!lim.monto||lim.monto<=0){if(noConfig)noConfig.style.display='block';if(barraWrap)barraWrap.style.display='none';this._renderBannerLimiteInicio(false,0,0);return;}
    if(noConfig)noConfig.style.display='none';
    if(barraWrap)barraWrap.style.display='block';
    const pct=Math.min(100,Math.round((totalGastado/lim.monto)*100));
    const disponible=Math.max(0,lim.monto-totalGastado);
    const excedido=totalGastado>lim.monto;
    const color=excedido?'#dc2626':pct>=80?'#f59e0b':'#16a34a';
    const eg=document.getElementById('limite-gastado-txt'),ed=document.getElementById('limite-disponible-txt'),ef=document.getElementById('limite-barra-fill'),ee=document.getElementById('limite-estado-txt');
    if(eg)eg.textContent=`${Fmt.monto(totalGastado)} gastado`;
    if(ed)ed.textContent=`de ${Fmt.monto(lim.monto)}`;
    if(ef){ef.style.width=`${pct}%`;ef.style.background=color;}
    if(ee){ee.style.color=color;ee.textContent=excedido?`⚠️ Excedido en ${Fmt.monto(totalGastado-lim.monto)}`:pct>=80?`Cuidado: ${pct}% del límite usado`:`${Fmt.monto(disponible)} disponible (${100-pct}%)`;}
    // Banner en inicio si excedido o cerca
    this._renderBannerLimiteInicio(excedido||pct>=80, excedido, pct, totalGastado, lim.monto);
  },

  _renderBannerLimiteInicio(mostrar, excedido, pct, gastado, limite) {
    const banner = document.getElementById('banner-limite-inicio');
    if(!banner) return;
    if(!mostrar){ banner.style.display='none'; banner.innerHTML=''; return; }
    const color  = excedido ? '#dc2626' : '#f59e0b';
    const icono  = excedido ? '🚨' : '⚠️';
    const titulo = excedido ? '¡Límite mensual excedido!' : `Cuidado: ${pct}% del límite usado`;
    const exceso = Fmt.monto(gastado-limite);
    const queda  = Fmt.monto(limite-gastado);
    const detalle= excedido
      ? `Límite: ${Fmt.monto(limite)} · Exceso: <strong style="color:${color}">${exceso}</strong>`
      : `Usado: ${Fmt.monto(gastado)} · Disponible: <strong>${queda}</strong>`;
    banner.style.display = 'block';
    banner.style.margin  = '0 1rem 0.75rem';
    banner.innerHTML = `<div class="banner-limite" style="--lim-color:${color};border-color:${color};background:${color}18">
      <div class="banner-limite-ico">${icono}</div>
      <div class="banner-limite-info">
        <p class="banner-limite-titulo" style="color:${color}">${titulo}</p>
        <p class="banner-limite-detalle">${detalle}</p>
      </div>
    </div>`;
    // Asegurar que el texto no se desborde
    banner.querySelectorAll('strong').forEach(el=>{ el.style.whiteSpace='nowrap'; });
  },

  abrirModalTarjeta(tcExistente) {
    const esEdicion=!!tcExistente;
    document.getElementById('modal-tarjeta-titulo').textContent=esEdicion?'Editar tarjeta':'Nueva tarjeta';
    document.getElementById('tc-nombre').value=tcExistente?.nombre||'';
    document.getElementById('tc-banco').value=tcExistente?.banco||'';
    document.getElementById('tc-limite').value=tcExistente?.limite||'';
    document.getElementById('tc-corte').value=tcExistente?.corte||'';
    this._tcColorSeleccionado=tcExistente?.color||this.TC_COLORES[0];
    // Siempre asignar id correcto ('' si es nueva)
    document.getElementById('modal-tarjeta').dataset.editId=tcExistente?.id||'';
    const cont=document.getElementById('tc-colores');
    cont.innerHTML=this.TC_COLORES.map(c=>`<button class="tc-color-btn ${c===this._tcColorSeleccionado?'activo':''}" style="background:${c}" data-color="${c}"></button>`).join('');
    cont.querySelectorAll('.tc-color-btn').forEach(b=>{b.addEventListener('click',()=>{cont.querySelectorAll('.tc-color-btn').forEach(x=>x.classList.remove('activo'));b.classList.add('activo');this._tcColorSeleccionado=b.dataset.color;});});
    this._abrirModal('modal-tarjeta');
  },

  guardarTarjeta() {
    const nombre=Seguridad.limpiar(document.getElementById('tc-nombre').value);
    const banco=Seguridad.limpiar(document.getElementById('tc-banco').value);
    const limite=Seguridad.limpiarNumero(document.getElementById('tc-limite').value)||0;
    const corte=Math.min(31,Math.max(1,parseInt(document.getElementById('tc-corte').value)||1));
    const color=this._tcColorSeleccionado||this.TC_COLORES[0];
    if(!nombre){this.toast('⚠️ Escribe un nombre para la tarjeta');return;}
    const modal=document.getElementById('modal-tarjeta');
    const editId=modal?.dataset.editId||'';
    const tarjetas=Store.getTarjetas();
    if(editId){const idx=tarjetas.findIndex(t=>t.id===editId);if(idx>=0)tarjetas[idx]={...tarjetas[idx],nombre,banco,limite,corte,color};}
    else{tarjetas.push({id:'tc_'+Date.now().toString(36),nombre,banco,limite,corte,color});}
    Store.setTarjetas(tarjetas);
    if(modal) modal.dataset.editId=''; // limpiar para que el próximo uso empiece limpio
    this.cerrarModal('modal-tarjeta');
    this.renderTarjetas();
    this._actualizarSelectorTarjeta();
    this.toast(editId?'✓ Tarjeta actualizada':'✓ Tarjeta agregada');
  },

  abrirModalLimite() {
    const lim=Store.getLimite();
    document.getElementById('lim-monto').value=lim.monto||'';
    this._abrirModal('modal-limite');
    setTimeout(()=>document.getElementById('lim-monto').focus(),350);
  },

  guardarLimite() {
    const monto=Seguridad.limpiarNumero(document.getElementById('lim-monto').value)||0;
    Store.setLimite({monto});
    this.cerrarModal('modal-limite');
    this.renderTarjetas();
    this.toast(monto>0?`✓ Límite de ${Fmt.monto(monto)} configurado`:'✓ Límite eliminado');
  },

  _actualizarSelectorTarjeta() {
    const campo=document.getElementById('campo-tarjeta');
    const sel=document.getElementById('t-tarjeta');
    if(!campo||!sel) return;
    const tarjetas=Store.getTarjetas();
    if(!tarjetas.length||tipoModal!=='gasto'){campo.style.display='none';return;}
    campo.style.display='block';
    sel.innerHTML=`<option value="">💵 Efectivo</option>`+tarjetas.map(t=>`<option value="${t.id}">💳 ${Seguridad.limpiar(t.nombre)}</option>`).join('');
  },

  _verificarLimite(monto,callback) {
    const lim=Store.getLimite();
    if(!lim.monto||lim.monto<=0){callback();return;}
    const hoy=new Date(),mes=hoy.getMonth(),anio=hoy.getFullYear();
    const gastado=Store.getTrans().filter(t=>{const[y,m]=t.fecha.split('-');return t.tipo==='gasto'&&+m-1===mes&&+y===anio;}).reduce((s,t)=>s+t.monto,0);
    const nuevoTotal=gastado+monto;
    const excede=nuevoTotal>lim.monto;
    const casiExcede=!excede&&nuevoTotal>lim.monto*0.9;
    if(excede||casiExcede){
      const body=document.getElementById('advertencia-limite-body');
      if(body)body.innerHTML=excede
        ?`<strong>⚠️ Excederás tu límite mensual</strong><br><br>Límite: <strong>${Fmt.monto(lim.monto)}</strong><br>Gastado hasta ahora: ${Fmt.monto(gastado)}<br>Este gasto: ${Fmt.monto(monto)}<br><strong style="color:var(--gasto)">Total: ${Fmt.monto(nuevoTotal)}</strong>`
        :`<strong>Estás cerca del límite</strong><br><br>Has usado el ${Math.round((nuevoTotal/lim.monto)*100)}% de tu límite mensual.<br>Te quedarán solo <strong>${Fmt.monto(lim.monto-nuevoTotal)}</strong> disponibles.`;
      document.getElementById('btn-advertencia-continuar')?.addEventListener('click',()=>{this.cerrarModal('modal-advertencia-limite');callback();},{once:true});
      document.getElementById('btn-advertencia-cancelar')?.addEventListener('click',()=>{this.cerrarModal('modal-advertencia-limite');},{once:true});
      this._abrirModal('modal-advertencia-limite');
    } else {callback();}
  },

  // ── Transacciones ─────────────────────────────
  renderTransacciones() {
    document.getElementById('mes-label').textContent=Fmt.nombreMes(mesActual,anioActual);
    let trans=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mesActual&&+y===anioActual; });
    if(filtroTipo!=='todas') trans=trans.filter(t=>t.tipo===filtroTipo);
    trans.sort((a,b)=>b.fecha.localeCompare(a.fecha));
    // Límite mensual en Movimientos
    this._renderLimiteMensualEnMovimientos();

    // Renderizar gráfica (con todas las trans del mes, sin filtro de tipo)
    const transMes=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mesActual&&+y===anioActual; });
    const vistaActual = document.querySelector('.grafica-tab.activo')?.dataset.vista || 'donut';
    this.renderGrafica(transMes, vistaActual);

    const el=document.getElementById('lista-todas');
    if(!trans.length){ el.innerHTML=`<div class="estado-vacio"><div class="estado-vacio-ico">🔍</div><p>Sin movimientos</p></div>`; return; }
    const grupos={};
    trans.forEach(t=>{ const g=Fmt.fechaGrupo(t.fecha); if(!grupos[g])grupos[g]=[]; grupos[g].push(t); });
    el.innerHTML=Object.entries(grupos).map(([f,items])=>
      `<div class="grupo-fecha-titulo">${f}</div>`+items.map(t=>this._htmlTrans(t)).join('')
    ).join('');
    this._bindDel(el);
  },

  // ── Historial ─────────────────────────────────
  renderHistorial() {
    const el=document.getElementById('lista-historial');
    const hist=Store.getHistorial();
    const transMesActual=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===new Date().getMonth()&&+y===new Date().getFullYear(); });
    const nombreMesActual=Fmt.nombreMes(new Date().getMonth(),new Date().getFullYear());
    const ingA=transMesActual.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
    const gasA=transMesActual.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
    const salA=ingA-gasA; const posA=salA>=0;
    const cardActual=transMesActual.length?`<div class="card-historial" style="border-color:var(--acento);border-width:2px"><div class="hist-header"><span class="hist-mes-nombre">📅 ${nombreMesActual} <span style="font-size:11px;font-weight:500;color:var(--acento);background:var(--acento-light);padding:2px 8px;border-radius:10px;margin-left:6px">Mes actual</span></span><span class="hist-badge ${posA?'positivo':'negativo'}">${posA?'+':''}${Fmt.monto(salA)}</span></div><div class="hist-stats"><div class="hist-stat"><div class="hist-stat-label">Ingresos</div><div class="hist-stat-val ing">${Fmt.monto(ingA)}</div></div><div class="hist-stat"><div class="hist-stat-label">Gastos</div><div class="hist-stat-val gas">${Fmt.monto(gasA)}</div></div><div class="hist-stat"><div class="hist-stat-label">Movimientos</div><div class="hist-stat-val sal">${transMesActual.length}</div></div></div><div class="hist-acciones"><button class="btn-hist btn-hist-pdf" id="btn-pdf-mes-actual"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Descargar reporte</button></div></div>`:'';
    const sep=(hist.length&&transMesActual.length)?`<p style="font-size:11px;font-weight:600;color:var(--texto3);text-transform:uppercase;letter-spacing:.06em;padding:12px 2px 6px">Meses anteriores</p>`:'';
    if(!hist.length&&!transMesActual.length){ el.innerHTML=`<div class="estado-vacio"><div class="estado-vacio-ico">📂</div><p>Sin historial todavía</p><p>Agrega transacciones para ver el reporte aquí</p></div>`; return; }
    el.innerHTML=cardActual+sep;
    const btnPdfActual=document.getElementById('btn-pdf-mes-actual');
    if(btnPdfActual) {
      btnPdfActual.onclick=()=>{ PDF.generar({transacciones:transMesActual,nombre:nombreMesActual}); UI.toast('📄 Descargando reporte...'); };
    }
    if(hist.length){
      const cont=document.createElement('div');
      cont.innerHTML=hist.map(h=>{
        const ing=h.transacciones.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
        const gas=h.transacciones.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
        const sal=ing-gas; const pos=sal>=0;
        return `<div class="card-historial"><div class="hist-header"><span class="hist-mes-nombre">${h.nombre}</span><span class="hist-badge ${pos?'positivo':'negativo'}">${pos?'+':''}${Fmt.monto(sal)}</span></div><div class="hist-stats"><div class="hist-stat"><div class="hist-stat-label">Ingresos</div><div class="hist-stat-val ing">${Fmt.monto(ing)}</div></div><div class="hist-stat"><div class="hist-stat-label">Gastos</div><div class="hist-stat-val gas">${Fmt.monto(gas)}</div></div><div class="hist-stat"><div class="hist-stat-label">Movimientos</div><div class="hist-stat-val sal">${h.transacciones.length}</div></div></div><div class="hist-acciones"><button class="btn-hist btn-hist-pdf" data-clave="${h.claveMes}"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Descargar reporte</button><button class="btn-hist btn-hist-del" data-clave="${h.claveMes}"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Eliminar</button></div></div>`;
      }).join('');
      el.appendChild(cont);
      cont.querySelectorAll('.btn-hist-pdf').forEach(btn=>{ btn.onclick=()=>{ const h=Store.getHistorial().find(x=>x.claveMes===btn.dataset.clave); if(h){PDF.generar(h);UI.toast('📄 Descargando reporte...');} }; });
      cont.querySelectorAll('.btn-hist-del').forEach(btn=>{ btn.addEventListener('click',()=>{ if(!confirm(`¿Eliminar historial de ${btn.dataset.clave}?`)) return; Store.delHistorialMes(btn.dataset.clave); this.renderHistorial(); this.toast('Eliminado'); }); });
    }
  },

  // ── Metas ─────────────────────────────────────
  renderMetas() {
    const el=document.getElementById('lista-metas'), metas=Store.getMetas();
    if(!metas.length){ el.innerHTML=`<div class="estado-vacio"><div class="estado-vacio-ico">🎯</div><p>Sin metas todavía</p><p>Toca <strong>+</strong> para crear una</p></div>`; return; }
    el.innerHTML=metas.map(m=>{
      const pct=Math.min(100,Math.round((m.actual/m.objetivo)*100));
      return `<div class="card-meta"><div class="meta-header"><div class="meta-titulo"><span class="meta-emoji">${m.emoji||'🎯'}</span><span>${Seguridad.limpiar(m.nombre)}</span></div><span class="meta-pct">${pct}%</span></div><div class="meta-barra-bg"><div class="meta-barra-fill" style="width:${pct}%"></div></div><div class="meta-nums"><span>Ahorrado: <strong>${Fmt.monto(m.actual)}</strong></span><span>Meta: <strong>${Fmt.monto(m.objetivo)}</strong></span></div><div class="meta-acciones"><button class="btn-meta-accion btn-abonar" data-id="${m.id}" data-nombre="${Seguridad.limpiar(m.nombre)}">+ Abonar</button><button class="btn-meta-accion btn-eliminar-meta" data-id="${m.id}">Eliminar</button></div></div>`;
    }).join('');
    el.querySelectorAll('.btn-abonar').forEach(btn=>{ btn.addEventListener('click',()=>this.abrirModalAbonar(btn.dataset.id,btn.dataset.nombre)); });
    el.querySelectorAll('.btn-eliminar-meta').forEach(btn=>{ btn.addEventListener('click',()=>this.eliminarMeta(btn.dataset.id)); });
  },

  // ── Perfil ────────────────────────────────────
  renderPerfil() {
    const cfg=Store.getConfig();
    const nombre=Seguridad.limpiar(cfg.nombre)||'';
    const avatar=document.getElementById('perfil-avatar');
    if(avatar) avatar.textContent=nombre?nombre[0].toUpperCase():'M';
    const elN=document.getElementById('perfil-nombre-txt');
    if(elN) elN.textContent=nombre||'Mi Cuenta';
    const pNombre=document.getElementById('p-nombre');
    if(pNombre) pNombre.value=nombre;
    const pOscuro=document.getElementById('cfg-oscuro');
    if(pOscuro) pOscuro.checked=!!cfg.oscuro;
    this.renderTemasGrid(cfg.tema||'verde');
  },

  renderTemasGrid(temaActual) {
    const temas=[{id:'verde',color:'#16a34a'},{id:'azul',color:'#2563eb'},{id:'morado',color:'#7c3aed'},{id:'rosa',color:'#db2777'},{id:'naranja',color:'#ea580c'},{id:'teal',color:'#0d9488'}];
    const el=document.getElementById('temas-grid');
    if(!el) return;
    el.innerHTML=temas.map(t=>`<button class="tema-circulo ${t.id===temaActual?'activo':''}" style="background:${t.color}" data-tema="${t.id}" aria-label="Tema ${t.id}"></button>`).join('');
    el.querySelectorAll('.tema-circulo').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const cfg=Store.getConfig(); cfg.tema=btn.dataset.tema; Store.setConfig(cfg);
        App.aplicarTema(cfg); this.renderTemasGrid(btn.dataset.tema); this.toast('Tema aplicado ✓');
      });
    });
  },

  // ── HTML transacción ──────────────────────────
  _htmlTrans(t) {
    const cat=getCat(t.categoria), signo=t.tipo==='ingreso'?'+':'-';
    const bg=t.tipo==='ingreso'?'var(--ingreso-bg)':'var(--gasto-bg)';
    const nota=t.nota?' · '+Seguridad.limpiar(t.nota):'';
    const autoTag=t.automatico?'<span style="font-size:10px;background:var(--acento-light);color:var(--acento-texto);padding:1px 6px;border-radius:10px;margin-left:4px">Auto</span>':'';
    const tc = t.tarjetaId ? Store.getTarjetas().find(x=>x.id===t.tarjetaId) : null;
    const tcBadge = tc ? `<span class="metodo-pago-badge" style="background:${tc.color}22;color:${tc.color}">💳 ${Seguridad.limpiar(tc.nombre)}</span>` : '';
    return `<div class="item-trans"><div class="item-ico" style="background:${bg}">${cat.emoji}</div><div class="item-info"><p class="item-desc">${Seguridad.limpiar(t.descripcion)}${autoTag}${tcBadge}</p><p class="item-sub">${cat.nombre}${nota}</p></div><div class="item-der"><p class="item-monto-val ${t.tipo}">${signo} ${Fmt.monto(t.monto)}</p><p class="item-fecha-val">${Fmt.fechaCorta(t.fecha)}</p></div><button class="item-del" data-id="${t.id}" aria-label="Eliminar">✕</button></div>`;
  },

  _bindDel(el) {
    el.querySelectorAll('.item-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(!confirm('¿Eliminar esta transacción?')) return;
        Store.delTrans(btn.dataset.id);
        App.renderActual();
        this.toast('Transacción eliminada');
      });
    });
  },

  // ── Modal transacción ─────────────────────────
  abrirModalTrans() {
    document.getElementById('t-fecha').value=new Date().toISOString().slice(0,10);
    document.getElementById('t-monto').value='';
    document.getElementById('t-desc').value='';
    document.getElementById('t-nota').value='';
    document.getElementById('modal-trans-titulo').textContent='Nueva transacción';
    tipoModal='gasto';
    document.querySelectorAll('.tipo-tab').forEach(b=>b.classList.toggle('activo',b.dataset.tipo==='gasto'));
    this._actualizarCats();
    // Resetear paneles extra
    document.getElementById('salario-panel').style.display='none';
    document.getElementById('panel-recurrente').style.display='none';
    // Panel pendiente: visible solo en gastos
    const panelPriorReset = document.getElementById('panel-prioridad');
    if(panelPriorReset) panelPriorReset.style.display = tipoModal==='gasto' ? 'block' : 'none';
    const chkRec=document.getElementById('t-es-recurrente'); if(chkRec) chkRec.checked=false;
    const chkPri=document.getElementById('t-prioridad'); if(chkPri) chkPri.checked=false;
    const recDia=document.getElementById('recurrente-dia-row'); if(recDia) recDia.style.display='none';
    // Limpiar errores previos
    const zonaErr = document.getElementById('zona-error-trans');
    if (zonaErr) zonaErr.innerHTML = '';
    this._abrirModal('modal-trans');
    setTimeout(()=>document.getElementById('t-monto').focus(),350);
  },

  cerrarModal(id){
    const el = document.getElementById(id);
    if(el) el.classList.remove('visible');
    // Restaurar scroll — solo si no hay otro modal abierto
    const hayOtroModal = document.querySelector('.modal-overlay.visible');
    if(!hayOtroModal) {
      document.body.classList.remove('modal-abierto');
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width    = '';
    }
  },

  _abrirModal(id) {
    const el = document.getElementById(id);
    if(el) el.classList.add('visible');
    // Bloquear scroll del body — solo overflow, sin position:fixed que causa saltos
    document.body.style.overflow = 'hidden';
  },

  _actualizarCats() {
    const sel=document.getElementById('t-cat');
    sel.innerHTML=CATS[tipoModal].map(c=>`<option value="${c.id}">${c.emoji} ${c.nombre}</option>`).join('');
    this._checkAutoSueldo();
    const panelPend=document.getElementById('panel-prioridad');
    if(panelPend) panelPend.style.display=tipoModal==='gasto'?'block':'none';
    const panelRec=document.getElementById('panel-recurrente');
    if(panelRec&&tipoModal!=='gasto') panelRec.style.display='none';
    // Selector de tarjeta
    this._actualizarSelectorTarjeta();
  },

  // Notificación de error tipo tarjeta dentro del modal
  mostrarNotifError(id, mensaje) {
    // Remover previa si existe
    document.getElementById(id)?.remove();

    const notif = document.createElement('div');
    notif.id = id;
    notif.className = 'notif-error-inline';
    notif.innerHTML = `<span class="notif-error-ico">⚠️</span><span>${mensaje}</span><button class="notif-error-cerrar" onclick="document.getElementById('${id}')?.remove()">✕</button>`;

    // Insertar en el contenedor de errores del modal de transacción
    const zona = document.getElementById('zona-error-trans');
    if (zona) {
      zona.innerHTML = '';
      zona.appendChild(notif);
    }

    setTimeout(() => { document.getElementById(id)?.remove(); }, 4000);
  },

  // Auto-reconocimiento de categoría mientras el usuario escribe
  _autoDetectarCategoria(texto) {
    if (!texto || tipoModal !== 'gasto') return;
    const catDetectada = AutoCat.detectar(texto);
    if (!catDetectada) return;
    const sel = document.getElementById('t-cat');
    if (!sel) return;
    // Solo cambiar si la opción existe en el select actual
    const existe = Array.from(sel.options).some(o => o.value === catDetectada);
    if (existe && sel.value !== catDetectada) {
      sel.value = catDetectada;
      // Mostrar panel recurrente si es servicios
      this._checkPanelRecurrente(catDetectada);
      // Pequeño feedback visual
      sel.style.borderColor = 'var(--acento)';
      setTimeout(() => { sel.style.borderColor = ''; }, 1200);
    }
  },

  // Panel recurrente — aparece cuando categoría es servicios
  // El panel de pendiente se oculta en servicios (tiene su propio flujo)
  _checkPanelRecurrente(cat) {
    const panelRec  = document.getElementById('panel-recurrente');
    const panelPend = document.getElementById('panel-prioridad');
    if (!panelRec) return;
    const esServicioGasto = (cat === 'servicios' && tipoModal === 'gasto');
    // Panel recurrente: solo en servicios
    panelRec.style.display  = esServicioGasto ? 'block' : 'none';
    // Panel pendiente: en gastos que NO sean servicios
    if (panelPend) {
      panelPend.style.display = (tipoModal === 'gasto' && !esServicioGasto) ? 'block' : 'none';
    }
  },

  _checkAutoSueldo() {
    // Siempre ocultar panel-prioridad en ingresos
    const panelPrior = document.getElementById('panel-prioridad');
    if (panelPrior) panelPrior.style.display = tipoModal === 'gasto' ? 'block' : 'none';

    const cat=document.getElementById('t-cat')?.value;
    const monto=document.getElementById('t-monto');
    const panel=document.getElementById('salario-panel');
    if(!monto||!panel) return;
    if(cat==='salario'&&tipoModal==='ingreso') {
      panel.style.display='block';
      const cfg=Store.getConfig();
      if(cfg.sueldo&&cfg.sueldo>0&&!monto.value) {
        monto.value=cfg.sueldo;
        const desc=document.getElementById('t-desc');
        if(desc&&!desc.value.trim()) desc.value='Sueldo mensual';
      }
      const chk=document.getElementById('t-auto-salario');
      if(chk) chk.checked=!!cfg.sueldoActivo;
      const diaRow=document.getElementById('salario-dia-row');
      if(diaRow) diaRow.style.display=chk?.checked?'flex':'none';
      const dia=document.getElementById('t-dia-salario');
      if(dia) dia.value=cfg.diaSueldo||1;
    } else {
      panel.style.display='none';
      if(cat!=='salario'&&tipoModal==='ingreso') {
        const cfg=Store.getConfig();
        if(cfg.sueldo&&parseFloat(monto.value)===cfg.sueldo){ monto.value=''; const d=document.getElementById('t-desc'); if(d&&d.value==='Sueldo mensual') d.value=''; }
      }
    }
    // Mostrar/ocultar panel recurrente
    this._checkPanelRecurrente(cat);
  },

  // Datos temporales mientras se decide si el servicio está pagado
  _datosPendientesServicio: null,

  guardarTransaccion() {
    const desc =Seguridad.limpiar(document.getElementById('t-desc').value);
    const monto=Seguridad.limpiarNumero(document.getElementById('t-monto').value);
    const cat  =document.getElementById('t-cat').value;
    const fecha=Seguridad.limpiarFecha(document.getElementById('t-fecha').value);
    const nota =Seguridad.limpiar(document.getElementById('t-nota').value);
    const esPendiente = document.getElementById('t-prioridad')?.checked || false;

    if(!desc)  { this.toast('⚠️ Escribe una descripción'); return; }
    if(!monto) {
      UI.mostrarNotifError('monto-error', '💰 Debes ingresar un monto antes de guardar');
      document.getElementById('t-monto')?.focus();
      return;
    }
    if(!fecha) { this.toast('⚠️ Fecha inválida'); return; }

    // Si es servicio → preguntar primero si ya está pagado
    if(cat==='servicios'&&tipoModal==='gasto') {
      const esRecurrente=document.getElementById('t-es-recurrente')?.checked||false;
      const diaRec=Math.min(28,Math.max(1,parseInt(document.getElementById('t-dia-recurrente')?.value)||1));
      // Guardar datos temporalmente y abrir modal de confirmación
      this._datosPendientesServicio={desc,monto,cat,fecha,nota,esRecurrente,diaRec};
      this.cerrarModal('modal-trans');
      this._abrirModal('modal-servicio-pago');
      document.getElementById('servicio-pago-nombre').textContent=desc;
      document.getElementById('servicio-pago-monto').textContent=Fmt.monto(monto);
      return;
    }

    // Leer tarjeta seleccionada
    const tarjetaId = document.getElementById('t-tarjeta')?.value || '';

    // Si es gasto → verificar límite mensual
    if(tipoModal==='gasto' && !esPendiente) {
      this._verificarLimite(monto, ()=>{
        this._finalizarGuardadoTrans({desc,monto,cat,fecha,nota,esPendiente,tarjetaId});
      });
      return;
    }

    // Si está marcado como pendiente → solo registrar como pendiente, NO descontar saldo
    if(esPendiente&&tipoModal==='gasto') {
      const pends=Store.getPendientes();
      const hoy2=new Date(), mes2=hoy2.getMonth(), anio2=hoy2.getFullYear();
      const claveMes=`${anio2}-${String(mes2+1).padStart(2,'0')}`;
      pends.push({
        id:'pend_manual_'+Date.now().toString(36),
        claveMes, descripcion:desc, monto, categoria:cat,
        fechaVence:fecha, pagado:false, prioridad:true, recurrenteId:null
      });
      Store.setPendientes(pends);
      this.cerrarModal('modal-trans');
      App.renderActual();
      this.toast('🔴 Guardado como pendiente — no descuenta hasta que lo pagues');
      return;
    }

    // Gasto o ingreso normal → registrar directo
    this._finalizarGuardadoTrans({desc,monto,cat,fecha,nota,esPendiente:false,tarjetaId:''});
  },

  _finalizarGuardadoTrans({desc,monto,cat,fecha,nota,esPendiente,tarjetaId}) {
    // Verificar límite de tarjeta si se seleccionó una
    if(tarjetaId && tipoModal==='gasto' && !esPendiente) {
      const tc = Store.getTarjetas().find(t=>t.id===tarjetaId);
      if(tc && tc.limite>0) {
        const hoy2=new Date(),mes2=hoy2.getMonth(),anio2=hoy2.getFullYear();
        const usadoTC = Store.getTrans().filter(t=>{
          const[y,m]=t.fecha.split('-');
          return t.tipo==='gasto'&&t.tarjetaId===tarjetaId&&+m-1===mes2&&+y===anio2;
        }).reduce((s,t)=>s+t.monto,0);
        const nuevoUsado = usadoTC + monto;
        if(nuevoUsado > tc.limite) {
          // Mostrar advertencia de límite de tarjeta
          const body=document.getElementById('advertencia-limite-body');
          if(body) body.innerHTML=`<strong>⚠️ Excederás el límite de tu tarjeta</strong><br><br>
            Tarjeta: <strong>${Seguridad.limpiar(tc.nombre)}</strong><br>
            Límite: ${Fmt.monto(tc.limite)}<br>
            Usado: ${Fmt.monto(usadoTC)}<br>
            Este gasto: ${Fmt.monto(monto)}<br>
            <strong style="color:var(--gasto)">Total: ${Fmt.monto(nuevoUsado)} (+${Fmt.monto(nuevoUsado-tc.limite)} del límite)</strong>`;
          document.getElementById('btn-advertencia-continuar')?.addEventListener('click',()=>{
            this.cerrarModal('modal-advertencia-limite');
            this._registrarTransaccionFinal({desc,monto,cat,fecha,nota,pagado:true,prioridad:false,tarjetaId});
          },{once:true});
          document.getElementById('btn-advertencia-cancelar')?.addEventListener('click',()=>{
            this.cerrarModal('modal-advertencia-limite');
          },{once:true});
          this._abrirModal('modal-advertencia-limite');
          return;
        }
      }
    }

    if(esPendiente&&tipoModal==='gasto') {
      const hoy2=new Date(),mes2=hoy2.getMonth(),anio2=hoy2.getFullYear();
      const claveMes=`${anio2}-${String(mes2+1).padStart(2,'0')}`;
      const pends=Store.getPendientes();
      pends.push({id:'pend_manual_'+Date.now().toString(36),claveMes,descripcion:desc,monto,categoria:cat,fechaVence:fecha,pagado:false,prioridad:true,recurrenteId:null});
      Store.setPendientes(pends);
      this.cerrarModal('modal-trans');
      App.renderActual();
      this.toast('🔴 Guardado como pendiente — no descuenta hasta que lo pagues');
      return;
    }
    this._registrarTransaccionFinal({desc,monto,cat,fecha,nota,pagado:true,prioridad:false,tarjetaId});
  },

  _registrarTransaccionFinal({desc,monto,cat,fecha,nota,pagado,prioridad,tarjetaId}) {
    const t={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      tipo:tipoModal,descripcion:desc,monto,categoria:cat,fecha,nota,
      prioridad:prioridad||false, pagado:pagado!==false,
      tarjetaId: tarjetaId||''
    };
    if(!Store.addTrans(t)){ this.toast('❌ Error al guardar'); return; }

    if(cat==='salario'&&tipoModal==='ingreso') {
      const cfg=Store.getConfig();
      const autoActivo=document.getElementById('t-auto-salario')?.checked||false;
      const diaSal=Math.min(31,Math.max(1,parseInt(document.getElementById('t-dia-salario')?.value)||1));
      cfg.sueldo=monto; cfg.sueldoActivo=autoActivo; cfg.diaSueldo=diaSal;
      Store.setConfig(cfg);
      this.toast('✓ Salario guardado y perfil actualizado 💼');
    } else {
      this.toast('✓ Guardado');
    }
    this.cerrarModal('modal-trans');
    App.renderActual();
  },

  // Confirmar pago de servicio (desde modal-servicio-pago)
  confirmarPagoServicio(yaPagado) {
    const d = this._datosPendientesServicio;
    if(!d) return;
    this.cerrarModal('modal-servicio-pago');

    if(yaPagado) {
      // Registrar como gasto normal (descuenta del saldo)
      tipoModal='gasto';
      // Si hay un pendiente activo de este recurrente en este mes, marcarlo como pagado
      const hoyP=new Date(), mesP=hoyP.getMonth(), anioP=hoyP.getFullYear();
      const claveMesP=`${anioP}-${String(mesP+1).padStart(2,'0')}`;
      const pends=Store.getPendientes().map(p => {
        if(p.claveMes===claveMesP && p.descripcion===d.desc && !p.pagado)
          return {...p, pagado:true};
        return p;
      });
      Store.setPendientes(pends);
      this._registrarTransaccionFinal({desc:d.desc,monto:d.monto,cat:d.cat,fecha:d.fecha,nota:'Pago automático',pagado:true});
    } else {
      // Registrar como pendiente (NO descuenta del saldo)
      const hoy2=new Date(), mes2=hoy2.getMonth(), anio2=hoy2.getFullYear();
      const claveMes=`${anio2}-${String(mes2+1).padStart(2,'0')}`;
      // Verificar que no exista ya un pendiente para este servicio este mes
      const pendExiste = Store.getPendientes().some(p =>
        p.claveMes===claveMes && p.descripcion===d.desc && !p.pagado
      );
      if(!pendExiste) {
        const pends=Store.getPendientes();
        pends.push({
          id:'pend_serv_'+Date.now().toString(36),
          claveMes, descripcion:d.desc, monto:d.monto, categoria:d.cat,
          fechaVence:d.fecha, pagado:false, prioridad:true, recurrenteId:null
        });
        Store.setPendientes(pends);
      }
      this.toast('🔴 Pendiente de pago — aparecerá en alertas');
      App.renderActual();
    }

    // Si es recurrente → guardar en lista
    if(d.esRecurrente) {
      const recurrentes=Store.getRecurrentes();
      const yaExiste=recurrentes.find(r=>r.descripcion===d.desc&&r.categoria===d.cat);
      if(!yaExiste) {
        recurrentes.push({
          id:'rec_'+Date.now().toString(36),
          descripcion:d.desc, monto:d.monto, categoria:d.cat,
          dia:d.diaRec, activo:true, prioridad:false
        });
        Store.setRecurrentes(recurrentes);
      }
    }
    this._datosPendientesServicio=null;
  },

  // ── Modal editar salario ──────────────────────
  abrirModalEditarSalario() {
    const cfg=Store.getConfig();
    document.getElementById('es-monto').value=cfg.sueldo||'';
    document.getElementById('es-dia').value=cfg.diaSueldo||1;
    document.getElementById('es-auto').checked=!!cfg.sueldoActivo;
    this._abrirModal('modal-editar-salario');
    setTimeout(()=>document.getElementById('es-monto').focus(),350);
  },

  guardarEdicionSalario() {
    const nuevoMonto=Seguridad.limpiarNumero(document.getElementById('es-monto').value);
    const dia=Math.min(31,Math.max(1,parseInt(document.getElementById('es-dia').value)||1));
    const auto=document.getElementById('es-auto').checked;
    if(!nuevoMonto){ this.toast('⚠️ Monto inválido'); return; }

    const cfg=Store.getConfig();
    const anterior=cfg.sueldo||0;

    if(anterior>0&&nuevoMonto!==anterior) {
      // Flujo de confirmación de 3 pasos
      const ok1=confirm(`⚠️ Vas a cambiar el salario\n\nAnterior: ${Fmt.monto(anterior)}\nNuevo: ${Fmt.monto(nuevoMonto)}\n\n¿Estás seguro?`);
      if(!ok1){ this.toast('Cambio cancelado'); return; }

      const hayTrans=Store.getTrans().some(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===new Date().getMonth()&&+y===new Date().getFullYear(); });
      if(hayTrans) {
        const ok2=confirm(`📅 El mes actual ya tiene transacciones.\n\n¿Deseas reiniciar (archivar) el mes actual?\n\n• Aceptar → archiva el mes y empieza de cero\n• Cancelar → solo cambia el salario, el mes no se toca`);
        if(ok2) {
          const ok3=confirm(`⚠️ ÚLTIMA CONFIRMACIÓN\n\n¿Ya descargaste el reporte en PDF?\n\n• Aceptar → Sí, continuar\n• Cancelar → No, quiero descargar primero`);
          if(!ok3) {
            const mes=new Date().getMonth(), anio=new Date().getFullYear();
            const transMes=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mes&&+y===anio; });
            if(transMes.length) PDF.generar({transacciones:transMes,nombre:Fmt.nombreMes(mes,anio)});
            this.toast('📄 Descargando reporte. Intenta de nuevo después.');
            return;
          }
          Store.cerrarMes(new Date().getMonth(),new Date().getFullYear());
          // Resetear marcador de sueldo aplicado este mes
          const claveMes=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
          Store.setSApl(Store.getSApl().filter(k=>k!==claveMes));
          this.toast('✓ Mes archivado');
        }
      }
    }

    // Aplicar el nuevo salario en config
    cfg.sueldo=nuevoMonto; cfg.diaSueldo=dia; cfg.sueldoActivo=auto;
    Store.setConfig(cfg);

    // Actualizar o crear la transacción de salario del mes actual
    const hoy=new Date(), mes=hoy.getMonth(), anio=hoy.getFullYear();
    const fechaSal=`${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const todas=Store.getTrans();

    // Buscar si ya existe una transacción de salario este mes
    const idxExistente=todas.findIndex(t=>{
      const[y,m]=t.fecha.split('-');
      return t.categoria==='salario'&&t.tipo==='ingreso'&&+m-1===mes&&+y===anio;
    });

    if(idxExistente>=0) {
      // Actualizar la transacción existente con el nuevo monto
      todas[idxExistente]={...todas[idxExistente],monto:nuevoMonto,fecha:fechaSal};
      Store.setTrans(todas);
    } else {
      // No había ninguna este mes → crear una nueva
      Store.addTrans({
        id:'sal_edit_'+Date.now().toString(36),
        tipo:'ingreso',descripcion:'Sueldo mensual',
        monto:nuevoMonto,categoria:'salario',
        fecha:fechaSal,nota:'Actualizado',automatico:false
      });
    }

    this.cerrarModal('modal-editar-salario');
    App.renderActual();
    this.toast('✓ Salario actualizado y saldo reflejado');
  },

  // ── Metas — modales ───────────────────────────
  abrirModalMeta() {
    ['m-nombre','m-objetivo','m-actual','m-emoji'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    this._abrirModal('modal-meta');
  },

  guardarMeta() {
    const nombre=Seguridad.limpiar(document.getElementById('m-nombre').value);
    const objetivo=Seguridad.limpiarNumero(document.getElementById('m-objetivo').value);
    const actual=Math.max(0,parseFloat(document.getElementById('m-actual').value)||0);
    const emoji=Seguridad.limpiarEmoji(document.getElementById('m-emoji').value)||'🎯';
    if(!nombre){ this.toast('⚠️ Escribe un nombre'); return; }
    if(!objetivo){ this.toast('⚠️ Monto objetivo inválido'); return; }
    const metas=Store.getMetas();
    metas.push({id:Date.now().toString(36),nombre,objetivo,actual,emoji});
    Store.setMetas(metas);
    this.cerrarModal('modal-meta');
    this.renderMetas();
    this.toast('✓ Meta creada');
  },

  abrirModalAbonar(id,nombre) {
    metaAbonarId=id;
    document.getElementById('abonar-titulo').textContent=`Abonar a: ${nombre}`;
    document.getElementById('abonar-monto').value='';
    document.getElementById('radio-descontar').checked=true;
    this._abrirModal('modal-abonar');
    setTimeout(()=>document.getElementById('abonar-monto').focus(),350);
  },

  confirmarAbono() {
    const monto=Seguridad.limpiarNumero(document.getElementById('abonar-monto').value);
    if(!monto){ this.toast('⚠️ Monto inválido'); return; }
    const descontar=document.getElementById('radio-descontar').checked;
    const metas=Store.getMetas().map(m=>m.id!==metaAbonarId?m:{...m,actual:Math.min(m.objetivo,m.actual+monto)});
    Store.setMetas(metas);
    if(descontar) {
      const meta=Store.getMetas().find(m=>m.id===metaAbonarId);
      Store.addTrans({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),tipo:'gasto',descripcion:`Abono a meta: ${Seguridad.limpiar(meta?.nombre||'')}`,monto,categoria:'metas_gasto',fecha:new Date().toISOString().slice(0,10),nota:'Descontado del saldo'});
      this.toast(`✓ Abonado ${Fmt.monto(monto)} y descontado del saldo`);
    } else {
      this.toast(`✓ Abonado ${Fmt.monto(monto)} a la meta`);
    }
    this.cerrarModal('modal-abonar');
    this.renderMetas();
    if(descontar) App.renderActual();
  },

  eliminarMeta(id) {
    if(!confirm('¿Eliminar esta meta?')) return;
    Store.setMetas(Store.getMetas().filter(m=>m.id!==id));
    this.renderMetas();
    this.toast('Meta eliminada');
  },

  // ── Perfil — guardar ──────────────────────────
  guardarPerfil() {
    const cfg=Store.getConfig();
    cfg.nombre=Seguridad.limpiar(document.getElementById('p-nombre')?.value||'');
    cfg.oscuro=document.getElementById('cfg-oscuro')?.checked||false;
    Store.setConfig(cfg);
    App.aplicarTema(cfg);
    const elN=document.getElementById('nombre-usuario');
    if(elN) elN.textContent=cfg.nombre||'Mi Cuenta';
    const avatar=document.getElementById('perfil-avatar');
    if(avatar&&cfg.nombre) avatar.textContent=cfg.nombre[0].toUpperCase();
    const elNP=document.getElementById('perfil-nombre-txt');
    if(elNP) elNP.textContent=cfg.nombre||'Mi Cuenta';
    this.toast('✓ Perfil guardado');
  },

  confirmarBorrarDatos() {
    if(!confirm('⚠️ ¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) return;
    if(!confirm('¿Seguro? Se borran transacciones, metas e historial.')) return;
    Store.borrarTodo();
    App.renderActual();
    this.toast('Datos borrados');
  },

  // ── Menú Más ──────────────────────────────────
  abrirMenuMas() {
    this._abrirModal('menu-mas');
  },

  // ── Reportes ──────────────────────────────────
  abrirMenuReportes() {
    const contenedor = document.getElementById('reportes-lista');
    if (!contenedor) return;

    const hoy = new Date();
    const mesActualIdx = hoy.getMonth();
    const anioActual2 = hoy.getFullYear();

    // Mes actual
    const transMesActual = Store.getTrans().filter(t => {
      const [y,m] = t.fecha.split('-');
      return +m-1===mesActualIdx && +y===anioActual2;
    });
    const hist = Store.getHistorial();

    const items = [];

    if (transMesActual.length) {
      const ing = transMesActual.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
      const gas = transMesActual.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
      items.push({
        nombre: Fmt.nombreMes(mesActualIdx, anioActual2) + ' (mes actual)',
        detalle: `${transMesActual.length} movimientos · Saldo: ${Fmt.monto(ing-gas)}`,
        trans: transMesActual,
        esActual: true
      });
    }

    hist.forEach(h => {
      const ing = h.transacciones.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
      const gas = h.transacciones.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
      items.push({
        nombre: h.nombre,
        detalle: `${h.transacciones.length} movimientos · Saldo: ${Fmt.monto(ing-gas)}`,
        trans: h.transacciones,
        esActual: false
      });
    });

    if (!items.length) {
      contenedor.innerHTML = `<div class="presup-item-vacio">No hay transacciones para generar reportes todavía.</div>`;
    } else {
      contenedor.innerHTML = items.map((it, i) => `
        <div class="reporte-item">
          <div class="reporte-item-info">
            <p class="reporte-item-nombre">${it.esActual ? '📅 ' : '📁 '}${it.nombre}</p>
            <p class="reporte-item-detalle">${it.detalle}</p>
          </div>
          <button class="reporte-item-btn" data-idx="${i}">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar
          </button>
        </div>`).join('');

      contenedor.querySelectorAll('.reporte-item-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const it = items[+btn.dataset.idx];
          PDF.generar({ transacciones: it.trans, nombre: it.nombre });
          this.toast('📄 Generando reporte...');
        });
      });
    }

    this._abrirModal('modal-reportes');
  },

  // ── Presupuesto ───────────────────────────────
  _presupuestoItems: { fijos: [], variables: [], extras: [] },

  renderPresupuesto() {
    const cfg = Store.getConfig();
    const guardado = Store.getPresupuesto();

    // Nombre
    const elNombre = document.getElementById('presup-nombre');
    if (elNombre) { elNombre.value = guardado.nombre || ''; elNombre.oninput = () => this._presupuestoGuardar(); }

    // Ingreso base: usar salario si hay, si no el guardado
    const salario = cfg.sueldo || 0;
    const ingresoBase = guardado.ingreso || salario;
    const elIngreso = document.getElementById('presup-ingreso');
    if (elIngreso) { elIngreso.value = ingresoBase || ''; elIngreso.oninput = () => this.presupuestoRecalcular(); }

    // Cargar items guardados (o generar desde recurrentes si no hay)
    if (guardado.fijos && guardado.fijos.length) {
      this._presupuestoItems.fijos = guardado.fijos.map(f=>({...f}));
    } else {
      const recurrentes = Store.getRecurrentes().filter(r => r.activo);
      this._presupuestoItems.fijos = recurrentes.map(r => ({
        id: 'pf_' + r.id,
        desc: r.descripcion,
        monto: r.monto
      }));
    }

    this._presupuestoItems.extras = (guardado.extras && guardado.extras.length)
      ? guardado.extras.map(e=>({...e}))
      : [];

    this._presupuestoItems.variables = (guardado.variables && guardado.variables.length)
      ? guardado.variables.map(v=>({...v}))
      : [];

    this._presupuestoRenderListas();
    this.presupuestoRecalcular();
  },

  _presupuestoRenderListas() {
    this._presupuestoRenderLista('fijos',     'presup-lista-fijos',     'Ej: Internet, Netflix...');
    this._presupuestoRenderLista('variables', 'presup-lista-variables', 'Ej: Comida, ropa, gustos...');
    this._presupuestoRenderLista('extras',    'presup-lista-extras',    'Ej: Laptop, Celular...');
  },

  _presupuestoRenderLista(tipo, elId, placeholder) {
    const el = document.getElementById(elId);
    if (!el) return;
    const items = this._presupuestoItems[tipo];

    if (!items.length) {
      el.innerHTML = `<p class="presup-item-vacio">${tipo==='fijos' ? '— Sin gastos fijos. Toca + para agregar.' : '— Sin artículos. Toca + para agregar.'}</p>`;
      return;
    }

    el.innerHTML = '';
    items.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'presup-item';
      div.innerHTML = `
        <input class="presup-item-desc" type="text" value="${Seguridad.limpiar(item.desc)}" placeholder="${placeholder}" maxlength="50"/>
        <span style="font-size:13px;color:var(--texto3);flex-shrink:0">Q</span>
        <input class="presup-item-monto" type="number" value="${item.monto||''}" placeholder="0.00" min="0" step="0.01" inputmode="decimal"/>
        <button class="presup-item-del" title="Eliminar">✕</button>`;

      div.querySelector('.presup-item-desc').addEventListener('input', e => {
        this._presupuestoItems[tipo][i].desc = e.target.value;
        this._presupuestoGuardar();
      });
      div.querySelector('.presup-item-monto').addEventListener('input', e => {
        this._presupuestoItems[tipo][i].monto = parseFloat(e.target.value)||0;
        this.presupuestoRecalcular();
      });
      div.querySelector('.presup-item-del').addEventListener('click', () => {
        this._presupuestoItems[tipo].splice(i, 1);
        this._presupuestoRenderLista(tipo, elId, placeholder);
        this.presupuestoRecalcular();
      });

      el.appendChild(div);
    });
  },

  presupuestoAgregarItem(tipo) {
    const id = tipo + '_' + Date.now().toString(36);
    this._presupuestoItems[tipo].push({ id, desc: '', monto: 0 });
    const MAP = {
      fijos:     { elId:'presup-lista-fijos',     ph:'Ej: Internet, Netflix...' },
      variables: { elId:'presup-lista-variables', ph:'Ej: Comida, ropa, gustos...' },
      extras:    { elId:'presup-lista-extras',    ph:'Ej: Laptop, Celular...' }
    };
    const m = MAP[tipo]; if(!m) return;
    this._presupuestoRenderLista(tipo, m.elId, m.ph);
    this.presupuestoRecalcular();
    setTimeout(() => {
      const inputs = document.querySelectorAll(`#${m.elId} .presup-item-desc`);
      if (inputs.length) inputs[inputs.length-1].focus();
    }, 50);
  },

  presupuestoEditarIngreso() {
    document.getElementById('presup-ingreso')?.focus();
    document.getElementById('presup-ingreso')?.select();
  },

  presupuestoRecalcular() {
    const ingreso      = parseFloat(document.getElementById('presup-ingreso')?.value) || 0;
    const totalFijos   = this._presupuestoItems.fijos.reduce((s,i)=>s+(i.monto||0), 0);
    const totalVars    = this._presupuestoItems.variables.reduce((s,i)=>s+(i.monto||0), 0);
    const totalExtras  = this._presupuestoItems.extras.reduce((s,i)=>s+(i.monto||0), 0);
    const totalGasto   = totalFijos + totalVars + totalExtras;
    const saldo  = ingreso - totalGasto;
    const pct    = ingreso > 0 ? Math.min(100, Math.round((totalGasto/ingreso)*100)) : 0;
    const color  = saldo < 0 ? '#dc2626' : pct >= 80 ? '#f59e0b' : '#16a34a';

    const s  = (id, txt) => { const e=document.getElementById(id); if(e) e.textContent=txt; };
    const ss = (id, st)  => { const e=document.getElementById(id); if(e) Object.assign(e.style,st); };

    s('presup-res-ingreso',  Fmt.monto(ingreso));
    s('presup-res-fijos',    '- ' + Fmt.monto(totalFijos));
    s('presup-res-variables','- ' + Fmt.monto(totalVars));
    s('presup-res-extras',   '- ' + Fmt.monto(totalExtras));
    s('presup-res-saldo',    (saldo < 0 ? '-' : '') + Fmt.monto(Math.abs(saldo)));
    s('presup-res-label',    saldo < 0 ? '⚠️ Te falta' : '✅ Saldo restante');
    s('presup-barra-label',  `${pct}% del presupuesto comprometido`);
    ss('presup-res-saldo', { color });

    const fill = document.getElementById('presup-barra-fill');
    if (fill) { fill.style.width=`${pct}%`; fill.style.background=color; }

    this._presupuestoGuardar();
  },

  _presupuestoGuardar() {
    const nombre  = document.getElementById('presup-nombre')?.value || '';
    const ingreso = parseFloat(document.getElementById('presup-ingreso')?.value) || 0;
    Store.setPresupuesto({
      nombre, ingreso,
      fijos:     this._presupuestoItems.fijos,
      variables: this._presupuestoItems.variables,
      extras:    this._presupuestoItems.extras
    });
  },

  presupuestoLimpiar() {
    if(!confirm('¿Limpiar "Otros gastos" y "Lo que quiero adquirir"?\n\nLos gastos fijos del mes se mantienen.')) return;
    this._presupuestoItems.variables = [];
    this._presupuestoItems.extras = [];
    this._presupuestoRenderListas();
    this.presupuestoRecalcular();
    this.toast('🗑️ Secciones limpiadas');
  },

  presupuestoDescargarPDF() {
    const nombre      = document.getElementById('presup-nombre')?.value || 'Mi Presupuesto';
    const ingreso     = parseFloat(document.getElementById('presup-ingreso')?.value) || 0;
    const fijos       = this._presupuestoItems.fijos;
    const variables   = this._presupuestoItems.variables;
    const extras      = this._presupuestoItems.extras;
    const totalFijos  = fijos.reduce((s,i)=>s+(i.monto||0),0);
    const totalVars   = variables.reduce((s,i)=>s+(i.monto||0),0);
    const totalExtras = extras.reduce((s,i)=>s+(i.monto||0),0);
    const totalGasto  = totalFijos + totalVars + totalExtras;
    const saldo       = ingreso - totalGasto;
    const pct         = ingreso > 0 ? Math.min(100,Math.round((totalGasto/ingreso)*100)) : 0;
    const colSaldo    = saldo >= 0 ? '#16a34a' : '#dc2626';
    const fechaGen    = new Date().toLocaleDateString('es-GT',{day:'numeric',month:'long',year:'numeric'});

    // Gráfica donut SVG: 3 segmentos (fijos, variables, extras)
    const segmentos = [
      {label:'Gastos fijos', val:totalFijos,  col:'#7c3aed'},
      {label:'Otros gastos', val:totalVars,   col:'#2563eb'},
      {label:'Por adquirir', val:totalExtras, col:'#ea580c'},
    ].filter(x=>x.val>0);

    let donutSVG = '';
    if (segmentos.length && totalGasto > 0) {
      const S=200,cx=S/2,cy=S/2,r=80,ri=50;
      let paths='',a=-Math.PI/2;
      segmentos.forEach(seg=>{
        const frac=seg.val/totalGasto,sweep=frac*2*Math.PI-0.02;
        const a2=a+sweep,lg=sweep>Math.PI?1:0;
        const x1o=cx+r*Math.cos(a+0.01),y1o=cy+r*Math.sin(a+0.01);
        const x2o=cx+r*Math.cos(a2),    y2o=cy+r*Math.sin(a2);
        const x1i=cx+ri*Math.cos(a2),   y1i=cy+ri*Math.sin(a2);
        const x2i=cx+ri*Math.cos(a+0.01),y2i=cy+ri*Math.sin(a+0.01);
        paths+=`<path d="M${x1o.toFixed(1)},${y1o.toFixed(1)} A${r},${r} 0 ${lg},1 ${x2o.toFixed(1)},${y2o.toFixed(1)} L${x1i.toFixed(1)},${y1i.toFixed(1)} A${ri},${ri} 0 ${lg},0 ${x2i.toFixed(1)},${y2i.toFixed(1)} Z" fill="${seg.col}"/>`;
        a+=frac*2*Math.PI;
      });
      donutSVG=`<div style="text-align:center;margin:20px 0">
        <svg viewBox="0 0 ${S} ${S}" width="180" height="180" style="display:inline-block">
          ${paths}
          <text x="${cx}" y="${cy-5}" text-anchor="middle" font-size="10" fill="#64748b" font-family="-apple-system,sans-serif">Total</text>
          <text x="${cx}" y="${cy+14}" text-anchor="middle" font-size="15" font-weight="800" fill="#0f172a" font-family="-apple-system,sans-serif">Q ${totalGasto.toFixed(2)}</text>
        </svg>
        <div style="display:flex;gap:16px;justify-content:center;margin-top:8px;flex-wrap:wrap">
          ${segmentos.map(seg=>`<span style="display:flex;align-items:center;gap:5px;font-size:12px;color:#475569"><span style="width:10px;height:10px;border-radius:50%;background:${seg.col};display:inline-block;flex-shrink:0"></span>${seg.label}: <strong>Q ${seg.val.toFixed(2)}</strong></span>`).join('')}
        </div>
      </div>`;
    }

    const mkTabla = (items, colorTotal, labelTotal) => {
      const filas = items.length ? items.map(f=>`<tr><td style="padding:7px 8px;font-size:13px">${Seguridad.limpiar(f.desc||'Sin nombre')}</td><td style="padding:7px 8px;text-align:right;font-weight:600">Q ${(f.monto||0).toFixed(2)}</td></tr>`).join('')
        : `<tr><td colspan="2" style="padding:10px;text-align:center;color:#94a3b8;font-size:13px">Sin items</td></tr>`;
      const total = items.reduce((s,i)=>s+(i.monto||0),0);
      return `<table><thead><tr><th>Descripción</th><th style="text-align:right">Monto</th></tr></thead>
        <tbody>${filas}</tbody>
        <tfoot><tr style="background:${colorTotal}22"><td style="padding:8px;font-weight:700">${labelTotal}</td><td style="padding:8px;text-align:right;font-weight:800;color:${colorTotal}">Q ${total.toFixed(2)}</td></tr></tfoot></table>`;
    };

    const html=`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
<title>Presupuesto: ${Seguridad.limpiar(nombre)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;background:#fff;padding:32px;max-width:680px;margin:0 auto}
@media print{.no-print{display:none!important}@page{margin:1.5cm}}
h1{font-size:22px;font-weight:800}h2{font-size:14px;font-weight:700;color:#1e293b;margin:22px 0 10px;padding-bottom:5px;border-bottom:2px solid #e2e8f0}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #7c3aed}
.cards{display:flex;gap:10px;margin-bottom:16px}
.card{flex:1;padding:14px;border-radius:10px;text-align:center}
.card .l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.card .v{font-size:18px;font-weight:800}
.c-a{background:#dcfce7}.c-a .l{color:#166534}.c-a .v{color:#16a34a}
.c-b{background:#ede9fe}.c-b .l{color:#5b21b6}.c-b .v{color:#7c3aed}
.c-c{background:#f1f5f9}.c-c .l{color:#475569}
table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:4px}
th{background:#f8fafc;text-align:left;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;border-bottom:1px solid #e2e8f0}
tr:nth-child(even){background:#f8fafc}
.barra-bg{height:12px;background:#e2e8f0;border-radius:6px;overflow:hidden;margin:12px 0 5px}
.barra-fill{height:100%;border-radius:6px;background:${pct>=100?'#dc2626':pct>=80?'#f59e0b':'#16a34a'};width:${pct}%}
.btn-p{display:block;margin:0 auto 20px;padding:10px 28px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
</style></head><body>
<button class="btn-p no-print" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
<div class="header">
  <div><p style="font-size:11px;color:#64748b;margin-bottom:3px">MIS FINANZAS · PRESUPUESTO</p>
    <h1>${Seguridad.limpiar(nombre)||'Mi Presupuesto'}</h1></div>
  <div style="text-align:right;font-size:12px;color:#94a3b8"><p>Generado el</p><p style="font-weight:600;color:#475569;margin-top:2px">${fechaGen}</p></div>
</div>
<div class="cards">
  <div class="card c-a"><div class="l">💰 Presupuesto</div><div class="v">Q ${ingreso.toFixed(2)}</div></div>
  <div class="card c-b"><div class="l">📦 Total comprometido</div><div class="v">Q ${totalGasto.toFixed(2)}</div></div>
  <div class="card c-c"><div class="l">${saldo>=0?'✅':'⚠️'} Saldo restante</div><div class="v" style="color:${colSaldo}">${saldo<0?'-':''}Q ${Math.abs(saldo).toFixed(2)}</div></div>
</div>
<div class="barra-bg"><div class="barra-fill"></div></div>
<p style="font-size:12px;color:#64748b;text-align:right;margin-bottom:8px">${pct}% del presupuesto comprometido</p>
${donutSVG}
<h2>📋 Gastos fijos del mes</h2>${mkTabla(fijos,'#7c3aed','Total fijos')}
<h2>🎯 Otros gastos del mes</h2>${mkTabla(variables,'#2563eb','Total otros gastos')}
<h2>🛍️ Lo que quiero adquirir</h2>${mkTabla(extras,'#ea580c','Total por adquirir')}
<p style="margin-top:32px;font-size:11px;color:#94a3b8;text-align:center">Mis Finanzas · Calculadora de Presupuesto</p>
</body></html>`;

    const blob=new Blob([html],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`Presupuesto_${Seguridad.limpiar(nombre).replace(/\s+/g,'_')||'Plan'}.html`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
    this.toast('📄 Descargando presupuesto...');
  },

  toast(msg) {
    const el=document.getElementById('toast');
    el.textContent=msg; el.classList.add('visible');
    clearTimeout(UI._tt);
    UI._tt=setTimeout(()=>el.classList.remove('visible'),2600);
  }
};

// ══════════════════════════════════════════════
//  APP
// ══════════════════════════════════════════════
const App = {
  pantalla:'inicio',

  irA(id) {
    document.querySelectorAll('.pantalla').forEach(p=>{
      p.classList.remove('activa');
      p.style.display='';   // limpiar cualquier display inline
    });
    const target=document.getElementById('pantalla-'+id);
    if(target) target.classList.add('activa');
    // Solo marcar activo en nav si es una pantalla de nav
    const navPantallas = ['inicio','transacciones','tarjetas'];
    document.querySelectorAll('.nav-btn[data-pantalla]').forEach(b=>b.classList.toggle('activo', navPantallas.includes(id) && b.dataset.pantalla===id));
    this.pantalla=id;
    this.renderActual();
    window.scrollTo(0,0);
  },

  renderActual() {
    switch(this.pantalla){
      case 'inicio':        UI.renderInicio(); break;
      case 'transacciones': UI.renderTransacciones(); break;
      case 'historial':     UI.renderHistorial(); break;
      case 'tarjetas':      UI.renderTarjetas(); break;
      case 'metas':         UI.renderMetas(); break;
      case 'perfil':        UI.renderPerfil(); break;
      case 'presupuesto':   UI.renderPresupuesto(); break;
    }
  },

  aplicarTema(cfg) {
    const b=document.body;
    b.classList.forEach(c=>{ if(c.startsWith('tema-')) b.classList.remove(c); });
    b.classList.add('tema-'+(cfg.tema||'verde'));
    b.classList.toggle('oscuro',!!cfg.oscuro);
    const colores={verde:'#16a34a',azul:'#2563eb',morado:'#7c3aed',rosa:'#db2777',naranja:'#ea580c',teal:'#0d9488'};
    const mt=document.getElementById('meta-theme');
    if(mt) mt.content=colores[cfg.tema]||'#16a34a';
  },

  init() {
    const cfg=Store.getConfig();
    this.aplicarTema(cfg);

    // Sueldo automático
    if(Sueldo.verificarYAplicar()) UI.toast('💼 Sueldo del mes registrado automáticamente');

    // Nav
    document.querySelectorAll('.nav-btn[data-pantalla]').forEach(btn=>{
      btn.addEventListener('click',()=>this.irA(btn.dataset.pantalla));
    });

    // FAB
    document.getElementById('btn-fab').addEventListener('click',()=>UI.abrirModalTrans());

    // Botón Más
    document.getElementById('btn-mas-menu')?.addEventListener('click',()=>UI.abrirMenuMas());

    // Tipo tabs
    document.querySelectorAll('.tipo-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.tipo-tab').forEach(b=>b.classList.remove('activo'));
        btn.classList.add('activo');
        tipoModal=btn.dataset.tipo;
        UI._actualizarCats();
        // Ocultar panel pendiente si se cambia a Ingreso
        const panelPend=document.getElementById('panel-prioridad');
        if(panelPend) panelPend.style.display = tipoModal==='gasto' ? 'block' : 'none';
        const panelRec=document.getElementById('panel-recurrente');
        if(panelRec) panelRec.style.display='none';
      });
    });

    // Cambio de categoría
    document.getElementById('t-cat')?.addEventListener('change',()=>{
      UI._checkAutoSueldo();
      UI._checkPanelRecurrente(document.getElementById('t-cat').value);
    });

    // Auto-detect mientras escribe descripción
    document.getElementById('t-desc')?.addEventListener('input',e=>{
      UI._autoDetectarCategoria(e.target.value);
    });

    // Toggle auto salario en modal
    document.getElementById('t-auto-salario')?.addEventListener('change',e=>{
      const row=document.getElementById('salario-dia-row');
      if(row) row.style.display=e.target.checked?'flex':'none';
    });

    // Toggle recurrente en modal
    document.getElementById('t-es-recurrente')?.addEventListener('change',e=>{
      const row=document.getElementById('recurrente-dia-row');
      if(row) row.style.display=e.target.checked?'flex':'none';
    });

    // Guardar transacción
    document.getElementById('btn-guardar-trans')?.addEventListener('click',()=>UI.guardarTransaccion());
    document.getElementById('btn-guardar-tarjeta')?.addEventListener('click',()=>UI.guardarTarjeta());

    // Eliminar tarjeta: manejado con onclick directo en el HTML
    document.getElementById('btn-guardar-limite')?.addEventListener('click',()=>UI.guardarLimite());
    document.getElementById('btn-guardar-meta')?.addEventListener('click',()=>UI.guardarMeta());
    document.getElementById('btn-confirmar-abono')?.addEventListener('click',()=>UI.confirmarAbono());
    document.getElementById('btn-confirmar-editar-salario')?.addEventListener('click',()=>UI.guardarEdicionSalario());

    // Tabs gráfica
    document.querySelectorAll('.grafica-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.grafica-tab').forEach(b=>b.classList.remove('activo'));
        btn.classList.add('activo');
        const transMes=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mesActual&&+y===anioActual; });
        UI.renderGrafica(transMes, btn.dataset.vista);
      });
    });

    // Filtros transacciones
    document.querySelectorAll('.filtro-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll('.filtro-btn').forEach(b=>b.classList.remove('activo'));
        btn.classList.add('activo'); filtroTipo=btn.dataset.filtro; UI.renderTransacciones();
      });
    });

    // Navegación mes
    document.getElementById('btn-mes-ant')?.addEventListener('click',()=>{ mesActual--; if(mesActual<0){mesActual=11;anioActual--;} this.renderActual(); });
    document.getElementById('btn-mes-sig')?.addEventListener('click',()=>{ mesActual++; if(mesActual>11){mesActual=0;anioActual++;} this.renderActual(); });

    // Cerrar modales por fondo
    document.querySelectorAll('.modal-overlay').forEach(ov=>{
      ov.addEventListener('click',e=>{ if(e.target===ov) ov.classList.remove('visible'); });
    });

    // Enter en campos
    ['t-desc','t-monto','t-nota'].forEach(id=>{ document.getElementById(id)?.addEventListener('keydown',e=>{ if(e.key==='Enter') UI.guardarTransaccion(); }); });
    document.getElementById('abonar-monto')?.addEventListener('keydown',e=>{ if(e.key==='Enter') UI.confirmarAbono(); });
    document.getElementById('es-monto')?.addEventListener('keydown',e=>{ if(e.key==='Enter') UI.guardarEdicionSalario(); });

    // Perfil auto-save
    document.getElementById('p-nombre')?.addEventListener('change',()=>UI.guardarPerfil());
    document.getElementById('cfg-oscuro')?.addEventListener('change',()=>UI.guardarPerfil());

    // SW
    if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

    this.irA('inicio');
  }
};

document.addEventListener('DOMContentLoaded',()=>App.init());