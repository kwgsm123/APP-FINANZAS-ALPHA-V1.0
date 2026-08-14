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
    [this.K_TRANS,this.K_METAS,this.K_CONFIG,this.K_HIST,this.K_SAPL,this.K_RECUR,this.K_PEND,this.K_TARJETAS,this.K_LIMITE,this.K_PRESUP,this.K_CUOTAS,this.K_EVENTOS].forEach(k=>localStorage.removeItem(k));
  },

  // ── Copia de seguridad: exportar/importar todos los datos ──
  exportarTodo() {
    return {
      app: 'mis-finanzas',
      version: 1,
      fecha: new Date().toISOString(),
      datos: {
        [this.K_TRANS]:  this._r(this.K_TRANS, []),
        [this.K_METAS]:  this._r(this.K_METAS, []),
        [this.K_CONFIG]: this._r(this.K_CONFIG, {}),
        [this.K_HIST]:   this._r(this.K_HIST, []),
        [this.K_SAPL]:   this._r(this.K_SAPL, []),
        [this.K_TARJETAS]: this._r(this.K_TARJETAS, []),
        [this.K_LIMITE]:   this._r(this.K_LIMITE, {}),
        [this.K_RECUR]:    this._r(this.K_RECUR, []),
        [this.K_PRESUP]:   this._r(this.K_PRESUP, {}),
        [this.K_PEND]:     this._r(this.K_PEND, []),
        [this.K_CUOTAS]:   this._r(this.K_CUOTAS, []),
        [this.K_EVENTOS]:  this._r(this.K_EVENTOS, [])
      }
    };
  },

  // Reemplaza todos los datos actuales con los del backup. Devuelve true/false.
  importarTodo(backup) {
    if(!backup || typeof backup !== 'object' || !backup.datos) return false;
    const clavesValidas = [this.K_TRANS,this.K_METAS,this.K_CONFIG,this.K_HIST,this.K_SAPL,this.K_TARJETAS,this.K_LIMITE,this.K_RECUR,this.K_PRESUP,this.K_PEND,this.K_CUOTAS,this.K_EVENTOS];
    try {
      clavesValidas.forEach(k => {
        if(backup.datos[k] !== undefined) this._w(k, backup.datos[k]);
      });
      return true;
    } catch { return false; }
  },

  // Recurrentes: [{id, descripcion, monto, categoria, dia, activo}]
  K_TARJETAS: 'mf_tarjetas_v1',
  K_LIMITE:   'mf_limite_v1',
  K_NOTIF_FLAGS: 'mf_notif_flags_v1',
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

  // Mantiene los "gastos fijos" del presupuesto sincronizados con los
  // servicios recurrentes y compras a cuotas activos — se llama justo en el
  // momento en que se agrega, paga o elimina un servicio/cuota, sin
  // depender de que la pantalla de Presupuesto esté abierta ni de que se
  // visite después. Así el cambio queda guardado de inmediato.
  sincronizarFijosPresupuesto() {
    const guardado = this.getPresupuesto();
    let fijos = (guardado.fijos || []).map(f => ({...f}));

    const recurrentesActivos = this.getRecurrentes().filter(r => r.activo);
    const idsRecActivos = new Set(recurrentesActivos.map(r => 'pf_' + r.id));
    fijos = fijos.filter(f => !(f.id && f.id.startsWith('pf_rec_') && !idsRecActivos.has(f.id)));
    recurrentesActivos.forEach(r => {
      const id = 'pf_' + r.id;
      const item = fijos.find(f => f.id === id);
      if (item) { item.monto = r.monto; item.desc = r.descripcion; }
      else fijos.push({ id, desc: r.descripcion, monto: r.monto });
    });

    const hoy = new Date();
    const claveMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
    const cuotasVigentes = this.getCuotas().filter(c =>
      c.activo && c.cuotasPagadas < c.cuotasTotales && (!c.mesInicio || c.mesInicio <= claveMes)
    );
    const idsCuotaActivas = new Set(cuotasVigentes.map(c => 'pf_cuota_' + c.id));
    fijos = fijos.filter(f => !(f.id && f.id.startsWith('pf_cuota_') && !idsCuotaActivas.has(f.id)));
    cuotasVigentes.forEach(c => {
      const id = 'pf_cuota_' + c.id;
      const desc = `${c.emoji || '🧾'} ${c.descripcion} (cuota ${c.cuotasPagadas+1} de ${c.cuotasTotales})`;
      const item = fijos.find(f => f.id === id);
      if (item) { item.monto = c.montoCuota; item.desc = desc; }
      else fijos.push({ id, desc, monto: c.montoCuota });
    });

    guardado.fijos = fijos;
    this.setPresupuesto(guardado);
  },

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
          prioridad: r.prioridad || false,
          tarjetaId: r.tarjetaId || ''
        });
      }
    });
    this.setPendientes(pendientes);
  },

  // Compras a cuotas: [{id, descripcion, montoCuota, categoria, cuotasTotales,
  //                      cuotasPagadas, dia, activo, fechaCreacion}]
  K_CUOTAS: 'mf_cuotas_v1',
  getCuotas()   { return this._r(this.K_CUOTAS, []); },
  setCuotas(a)  { return this._w(this.K_CUOTAS, a); },

  // Salidas / eventos con presupuesto propio: [{id, nombre, limite, fecha,
  // emoji, activo}]. Los gastos que pertenecen a una salida se marcan con
  // eventoId en la transacción (igual que tarjetaId).
  K_EVENTOS: 'mf_eventos_v1',
  getEventos()  { return this._r(this.K_EVENTOS, []); },
  setEventos(a) { return this._w(this.K_EVENTOS, a); },
  gastadoEvento(eventoId) {
    return this.getTrans()
      .filter(t => t.tipo==='gasto' && t.eventoId===eventoId)
      .reduce((s,t)=>s+t.monto, 0);
  },

  // Genera el pendiente del mes actual para cada compra a cuotas activa
  // que todavía no complete todos sus pagos.
  generarPendientesCuotas() {
    const hoy = new Date();
    const mes = hoy.getMonth(), anio = hoy.getFullYear();
    const claveMes = `${anio}-${String(mes+1).padStart(2,'0')}`;
    const cuotas = this.getCuotas().filter(c =>
      c.activo && c.cuotasPagadas < c.cuotasTotales && (!c.mesInicio || c.mesInicio <= claveMes)
    );
    const pendientes = this.getPendientes();

    cuotas.forEach(c => {
      const yaExiste = pendientes.some(p => p.cuotaId === c.id && p.claveMes === claveMes);
      if (!yaExiste) {
        const dia = Math.min(c.dia || 1, 28);
        const numeroCuota = c.cuotasPagadas + 1;
        pendientes.push({
          id: 'pend_cuota_' + c.id + '_' + claveMes,
          cuotaId: c.id,
          claveMes,
          descripcion: `${c.descripcion} (cuota ${numeroCuota} de ${c.cuotasTotales})`,
          monto: c.montoCuota,
          categoria: c.categoria || 'cuotas',
          emoji: c.emoji || '',
          fechaVence: `${anio}-${String(mes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`,
          pagado: false,
          prioridad: true,
          tarjetaId: ''
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
    // Servicios (recibos del hogar)
    { palabras: ['luz','electricidad','agua','internet','wifi','telefono','teléfono','celular','cable','gas','recibo','factura'], cat: 'servicios' },
    // Gastos recurrentes (membresías, suscripciones, cuotas mensuales fijas)
    { palabras: ['gym','gimnasio','membresia','membresía','mensualidad','netflix','spotify','streaming','suscripcion','suscripción','seguro','renta','alquiler','disney','hbo','youtube premium','icloud','nube'], cat: 'gastos_recurrentes' },
    // Ocio
    { palabras: ['cine','película','pelicula','concierto','teatro','entretenimiento','juego','videojuego','deporte','hobby','vacacion','vacaciones','tour','paseo','fiesta'], cat: 'ocio' },
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
    {id:'gastos_recurrentes',nombre:'Gastos recurrentes',emoji:'🔁'},
    {id:'ropa',nombre:'Ropa',emoji:'👕'},
    {id:'educacion',nombre:'Educación',emoji:'📚'},
    {id:'hogar',nombre:'Hogar',emoji:'🏠'},
    {id:'metas_gasto',nombre:'Metas',emoji:'🎯'},
    {id:'cuotas',nombre:'Cuotas',emoji:'🧾'},
    {id:'pago_tarjeta',nombre:'Pago tarjeta',emoji:'💳'},
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
  // Fecha de HOY en la zona horaria LOCAL del usuario, como 'YYYY-MM-DD'.
  // OJO: nunca usar new Date().toISOString().slice(0,10) para esto — toISOString()
  // convierte a UTC, y en Guatemala (UTC-6) eso adelanta la fecha un día
  // durante buena parte de la tarde/noche.
  hoyISO(){
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },
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
let filtroCategoria = 'todas';
let filtroMetodo = 'todos';
let filtroTarjetaId = 'todas';
let metaAbonarId = null;
let tarjetaAccionId = null;

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
    // Generar pendientes del mes si hay recurrentes o compras a cuotas
    Store.generarPendientesMes();
    Store.generarPendientesCuotas();

    const trans=Store.getTrans().filter(t=>{
      const[y,m]=t.fecha.split('-');
      return +m-1===mesActual&&+y===anioActual;
    });
    const ingresos=trans.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
    // Los gastos hechos con tarjeta NO se descuentan del saldo hasta que se pagan/abonan
    const gastos  =trans.filter(t=>t.tipo==='gasto' && !t.tarjetaId).reduce((s,t)=>s+t.monto,0);
    const saldo   =ingresos-gastos;

    const el=document.getElementById('saldo-principal');
    el.textContent = saldo<0 ? '-'+Fmt.monto(Math.abs(saldo)) : Fmt.monto(saldo);
    el.style.color = saldo<0 ? '#fca5a5' : '#fff';

    const card=document.getElementById('card-saldo-el');
    if(card) card.style.background = saldo<0 ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : '';

    this._renderGraficaSaldo(saldo);

    document.getElementById('mini-ingresos').textContent=Fmt.monto(ingresos);
    document.getElementById('mini-gastos').textContent  =Fmt.monto(gastos);

    const cfg=Store.getConfig();
    document.getElementById('nombre-usuario').textContent=Seguridad.limpiar(cfg.nombre)||'Mi Cuenta';
    this._actualizarAvatarUI(cfg);

    this._actualizarBannerSalario();
    this._renderLimiteGlobal();   // banner rojo si límite excedido
    this._renderPendientesAlerta();
    this._renderAlertaTarjetas(); // aviso de corte y pagos de tarjeta pendientes
    this._renderSalidaActivaInicio(); // progreso de salidas activas
    this._renderChips(trans);
    this._renderRecientes(trans);
  },

  // Gráfico tipo "trading" del saldo disponible: cada transacción de
  // efectivo del mes genera un punto nuevo (no cada día), así se nota el
  // cambio de inmediato al agregar un movimiento. Se pone rojo si el saldo
  // termina agotado/negativo.
  _renderGraficaSaldo(saldoActual) {
    const cont = document.getElementById('card-saldo-chart');
    if(!cont) return;
    const hoy = new Date(), anio=hoy.getFullYear(), mes=hoy.getMonth();

    const trans = Store.getTrans()
      .filter(t=>{ const[y,m]=t.fecha.split('-'); return +y===anio && +m-1===mes && !(t.tipo==='gasto' && t.tarjetaId); })
      .sort((a,b)=> a.fecha===b.fecha ? String(a.id).localeCompare(String(b.id)) : a.fecha.localeCompare(b.fecha));

    if(!trans.length) { cont.innerHTML=''; return; }

    let acumulado = 0;
    const puntos = [0]; // arranca en 0 al inicio del mes
    trans.forEach(t=>{ acumulado += (t.tipo==='ingreso' ? t.monto : -t.monto); puntos.push(acumulado); });

    const w=300, h=56, pad=3;
    let min=Math.min(...puntos), max=Math.max(...puntos);
    if(min===max) { min-=1; max+=1; } // evita división entre 0 si nunca ha variado
    const rango=max-min;
    const stepX=(w-pad*2)/(puntos.length-1);
    const coords=puntos.map((v,i)=>[
      pad+i*stepX,
      h-pad-((v-min)/rango)*(h-pad*2)
    ]);

    const negativo = saldoActual < 0;
    const colorLinea = negativo ? '#fecaca' : '#ffffff';
    const colorGlow  = negativo ? '#ef4444' : '#4ade80';

    const linePath = coords.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const areaPath = linePath+` L${coords[coords.length-1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;
    const ultimo = coords[coords.length-1];

    // Puntos discretos por cada movimiento — sutiles, y con datos para la
    // mini-tarjeta que aparece al pasar el cursor/dedo sobre ellos.
    const marcadores = coords.slice(1, -1).map((p,i)=>{
      const t = trans[i];
      const cat = getCat(t.categoria);
      const emoji = t.emoji || cat.emoji;
      const desc = Seguridad.limpiar(t.descripcion);
      return `<g>
        <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.6" fill="${colorLinea}" opacity="0.55"/>
        <circle class="punto-hit" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="7" fill="transparent" style="cursor:pointer" data-emoji="${emoji}" data-desc="${desc}" data-cat="${cat.nombre}" data-monto="${Fmt.monto(t.monto)}" data-tipo="${t.tipo}"/>
      </g>`;
    }).join('');
    const tUltimo = trans[trans.length-1];
    const catUltimo = getCat(tUltimo.categoria);
    const emojiUltimo = tUltimo.emoji || catUltimo.emoji;
    const descUltimo = Seguridad.limpiar(tUltimo.descripcion);

    cont.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colorGlow}" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="${colorGlow}" stop-opacity="0"/>
        </linearGradient>
        <filter id="glowSaldo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d="${areaPath}" fill="url(#gradSaldo)" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${colorLinea}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" filter="url(#glowSaldo)"/>
      ${marcadores}
      <circle cx="${ultimo[0].toFixed(1)}" cy="${ultimo[1].toFixed(1)}" r="3" fill="none" stroke="${colorLinea}" stroke-width="1.5" opacity="0.6">
        <animate attributeName="r" values="3;9" dur="1.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.6;0" dur="1.4s" repeatCount="indefinite"/>
      </circle>
      <circle class="punto-hit" cx="${ultimo[0].toFixed(1)}" cy="${ultimo[1].toFixed(1)}" r="3" fill="${colorLinea}" filter="url(#glowSaldo)" style="cursor:pointer" data-emoji="${emojiUltimo}" data-desc="${descUltimo}" data-cat="${catUltimo.nombre}" data-monto="${Fmt.monto(tUltimo.monto)}" data-tipo="${tUltimo.tipo}"/>
    </svg>`;

    this._bindGraficaTooltip(cont);
  },

  // Mini-tarjeta flotante (icono + descripción + monto) al pasar el cursor
  // o el dedo sobre un punto de la gráfica de saldo.
  _bindGraficaTooltip(cont) {
    const tip = document.getElementById('grafica-tooltip');
    if (!tip) return;

    const mostrar = (el, x, y) => {
      const { emoji, desc, cat, monto, tipo } = el.dataset;
      const signo = tipo === 'ingreso' ? '+' : '-';
      const bg = tipo === 'ingreso' ? 'var(--ingreso-bg)' : 'var(--gasto-bg)';
      tip.innerHTML = `<div class="gt-ico" style="background:${bg}">${emoji}</div>
        <div class="gt-info"><p class="gt-desc">${desc}</p><p class="gt-sub">${cat}</p></div>
        <p class="gt-monto ${tipo}">${signo} ${monto}</p>`;
      tip.style.display = 'flex';
      const tw = 190;
      let left = x - tw/2;
      left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
      let top = y - 68;
      if (top < 8) top = y + 16;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    };
    const ocultar = () => { tip.style.display = 'none'; };

    cont.querySelectorAll('.punto-hit').forEach(el => {
      el.addEventListener('mouseenter', e => mostrar(el, e.clientX, e.clientY));
      el.addEventListener('mousemove',  e => mostrar(el, e.clientX, e.clientY));
      el.addEventListener('mouseleave', ocultar);
      el.addEventListener('touchstart', e => {
        const t = e.touches[0];
        mostrar(el, t.clientX, t.clientY);
      }, {passive:true});
    });
    if (!this._graficaTooltipDocListener) {
      document.addEventListener('touchstart', e => {
        if (!e.target.closest('.punto-hit')) ocultar();
      }, {passive:true});
      this._graficaTooltipDocListener = true;
    }
  },

  _renderPendientesAlerta() {
    const contenedor = document.getElementById('alertas-pendientes');
    if (!contenedor) return;

    const hoy = new Date();
    const mes  = hoy.getMonth(), anio = hoy.getFullYear();
    const claveMes = `${anio}-${String(mes+1).padStart(2,'0')}`;

    const pendientes = Store.getPendientes().filter(p =>
      p.claveMes === claveMes && !p.pagado && !p.oculto
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
      const icoEmoji = p.emoji || cat.emoji;
      const vence = new Date(p.fechaVence+'T00:00:00');
      const diasFaltan = Math.ceil((vence-hoy)/(1000*60*60*24));
      const urgente = diasFaltan <= 3;
      const tc = p.tarjetaId ? Store.getTarjetas().find(t=>t.id===p.tarjetaId) : null;
      return `<div class="alerta-item ${urgente?'alerta-urgente':''}">
        <div class="alerta-ico">${icoEmoji}</div>
        <div class="alerta-info">
          <p class="alerta-desc">${Seguridad.limpiar(p.descripcion)}</p>
          <p class="alerta-sub">${urgente?'⚠️ Vence pronto':'Pendiente'} · ${Fmt.monto(p.monto)}${tc?` · 💳 ${Seguridad.limpiar(tc.nombre)}`:''}</p>
        </div>
        <div class="alerta-acciones">
          <button class="alerta-pagar-btn" data-pend-id="${p.id}">Pagar</button>
          <button class="alerta-del-btn" data-pend-del-id="${p.id}" aria-label="Eliminar pendiente">✕</button>
        </div>
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
        <div class="alerta-acciones">
          <button class="alerta-pagar-btn" data-trans-id="${t.id}">✓</button>
          <button class="alerta-del-btn" data-trans-del-id="${t.id}" aria-label="Eliminar pendiente">✕</button>
        </div>
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
      btn.addEventListener('click', () => this._pagarPendiente(btn.dataset.pendId));
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
    contenedor.querySelectorAll('[data-pend-del-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.pendDelId;
        const p = Store.getPendientes().find(x => x.id === id);
        if (!p) return;
        if (p.recurrenteId || p.cuotaId) {
          this._abrirEliminarPendienteVinculado(p);
          return;
        }
        this.confirmar('¿Eliminar este pendiente? Esta acción no se puede deshacer.', () => {
          Store.setPendientes(Store.getPendientes().map(x =>
            x.id === id ? {...x, oculto:true} : x
          ));
          App.renderActual();
          this.toast('🗑️ Pendiente eliminado');
        });
      });
    });
    contenedor.querySelectorAll('[data-trans-del-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.transDelId;
        this.confirmar('¿Eliminar este pendiente? Esta acción no se puede deshacer.', () => {
          Store.delTrans(id);
          App.renderActual();
          this.toast('🗑️ Pendiente eliminado');
        });
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

  // Deuda actual de una tarjeta = total cargado - total pagado/abonado (histórico, no se resetea cada mes)
  _deudaTarjeta(tcId) {
    const trans = Store.getTrans();
    const cargos = trans.filter(t=>t.tipo==='gasto' && t.tarjetaId===tcId).reduce((s,t)=>s+t.monto,0);
    const pagos  = trans.filter(t=>t.tipo==='gasto' && t.tarjetaPagoId===tcId).reduce((s,t)=>s+t.monto,0);
    return Math.max(0, Math.round((cargos-pagos)*100)/100);
  },

  // ── Ciclo de facturación (corte) ───────────────
  _diasEnMes(anio, mes) { return new Date(anio, mes+1, 0).getDate(); }, // mes 0-based
  _fechaCorte(anio, mes, corte) {
    const dia = Math.min(corte, this._diasEnMes(anio, mes));
    return new Date(anio, mes, dia);
  },
  _fmtFechaISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },

  // Calcula, para una tarjeta con día de corte configurado:
  // - montoCerrado: lo cargado en el ciclo que ya cerró (lo que hay que pagar ahora)
  // - montoAbierto: lo cargado en el ciclo actual, todavía acumulando
  // - montoAPagar: lo que realmente sigue debiéndose de ese ciclo cerrado
  // - esHoyCorte: si hoy es exactamente el día de corte de esta tarjeta
  _cicloTarjeta(tc) {
    const hoy = new Date();
    const corte = tc.corte || 0;
    if (!corte) return null;

    let anio = hoy.getFullYear(), mes = hoy.getMonth();
    let finCerrado;
    if (hoy.getDate() >= corte) {
      finCerrado = this._fechaCorte(anio, mes, corte);
    } else {
      let mAnt = mes - 1, aAnt = anio;
      if (mAnt < 0) { mAnt = 11; aAnt -= 1; }
      finCerrado = this._fechaCorte(aAnt, mAnt, corte);
    }

    // Inicio del ciclo cerrado = día siguiente al corte anterior a finCerrado
    let mPrev = finCerrado.getMonth() - 1, aPrev = finCerrado.getFullYear();
    if (mPrev < 0) { mPrev = 11; aPrev -= 1; }
    const cortePrev = this._fechaCorte(aPrev, mPrev, corte);
    const inicioCerrado = new Date(cortePrev); inicioCerrado.setDate(inicioCerrado.getDate()+1);

    // Ciclo abierto: empieza al día siguiente de finCerrado
    const inicioAbierto = new Date(finCerrado); inicioAbierto.setDate(inicioAbierto.getDate()+1);

    const inicioCerradoStr = this._fmtFechaISO(inicioCerrado);
    const finCerradoStr    = this._fmtFechaISO(finCerrado);
    const inicioAbiertoStr = this._fmtFechaISO(inicioAbierto);
    const hoyStr = this._fmtFechaISO(hoy);

    const cargos = Store.getTrans().filter(t => t.tipo==='gasto' && t.tarjetaId===tc.id);
    const montoCerrado = cargos.filter(t => t.fecha >= inicioCerradoStr && t.fecha <= finCerradoStr).reduce((s,t)=>s+t.monto,0);
    const montoAbierto  = cargos.filter(t => t.fecha >= inicioAbiertoStr && t.fecha <= hoyStr).reduce((s,t)=>s+t.monto,0);

    const deudaTotal = this._deudaTarjeta(tc.id);
    const montoAPagar = montoCerrado>0 ? Math.min(deudaTotal, montoCerrado) : 0;
    const esHoyCorte = hoyStr === finCerradoStr;

    return { finCerradoStr, montoCerrado, montoAbierto, montoAPagar, esHoyCorte };
  },

  // Muestra en Inicio el progreso de las salidas activas (límite de gasto
  // por evento). Al tocarla, lleva a la pantalla de Salidas con esa
  // tarjeta ya expandida mostrando el detalle.
  _renderSalidaActivaInicio() {
    const cont = document.getElementById('salida-activa-inicio');
    if (!cont) return;
    const hoy = Fmt.hoyISO();
    const activas = Store.getEventos().filter(e => e.activo && (!e.fecha || e.fecha >= hoy));
    if (!activas.length) { cont.style.display='none'; cont.innerHTML=''; return; }

    cont.style.display = 'block';
    cont.innerHTML = activas.map(ev => {
      const gastado = Store.gastadoEvento(ev.id);
      const restante = ev.limite - gastado;
      const pct = ev.limite>0 ? Math.min(100, Math.round((gastado/ev.limite)*100)) : 0;
      const excedido = restante < 0;
      return `<div class="card-salida-mini" data-ir-salida="${ev.id}">
        <div class="salida-mini-header">
          <span class="salida-mini-titulo">${ev.emoji||'🎉'} ${Seguridad.limpiar(ev.nombre)}</span>
          <span class="salida-mini-pct" style="${excedido?'color:var(--gasto)':''}">${pct}%</span>
        </div>
        <div class="meta-barra-bg"><div class="meta-barra-fill" style="width:${pct}%;${excedido?'background:var(--gasto)':''}"></div></div>
        <p class="salida-mini-sub">${excedido?`⚠️ Te pasaste por ${Fmt.monto(Math.abs(restante))}`:`Te quedan ${Fmt.monto(restante)} de ${Fmt.monto(ev.limite)}`}</p>
      </div>`;
    }).join('');

    cont.querySelectorAll('[data-ir-salida]').forEach(el => {
      el.addEventListener('click', () => {
        this._salidaExpandida = el.dataset.irSalida;
        App.irA('salidas');
      });
    });
  },

  // Aviso arriba en Inicio: tarjetas en día de corte hoy, y tarjetas con un
  // monto ya cerrado (del corte anterior) que sigue pendiente de pago.
  _renderAlertaTarjetas() {
    const tarjetas = Store.getTarjetas().filter(tc => tc.corte);
    const bannerCorte = document.getElementById('banner-corte-tarjeta');
    const alertaPago  = document.getElementById('alerta-pago-tarjetas');
    if (!bannerCorte || !alertaPago) return;

    const enCorteHoy = [];
    const porPagar = [];
    tarjetas.forEach(tc => {
      const ciclo = this._cicloTarjeta(tc);
      if (!ciclo) return;
      if (ciclo.esHoyCorte) enCorteHoy.push(tc);
      if (ciclo.montoAPagar > 0) porPagar.push({ tc, ciclo });
    });

    if (enCorteHoy.length) {
      const nombres = enCorteHoy.map(tc => Seguridad.limpiar(tc.nombre)).join(', ');
      bannerCorte.style.display = 'block';
      bannerCorte.style.margin = '0 1rem 0.75rem';
      bannerCorte.innerHTML = `<div class="banner-limite" style="--lim-color:#f59e0b;border-color:#f59e0b;background:#f59e0b18">
        <div class="banner-limite-ico">💳</div>
        <div class="banner-limite-info">
          <p class="banner-limite-titulo" style="color:#f59e0b">Tarjeta en día de corte</p>
          <p class="banner-limite-detalle">${nombres} — Esta tarjeta tiene su corte el día de hoy, asegúrate de revisar tus transacciones.</p>
        </div>
      </div>`;
    } else {
      bannerCorte.style.display = 'none';
      bannerCorte.innerHTML = '';
    }

    if (porPagar.length) {
      alertaPago.style.display = 'block';
      alertaPago.style.margin = '0 1rem 0.75rem';
      alertaPago.innerHTML = porPagar.map(({tc, ciclo}) => `
        <div class="banner-limite" style="--lim-color:#2563eb;border-color:#2563eb;background:#2563eb18;margin-bottom:8px;cursor:pointer" data-ver-tc="${tc.id}">
          <div class="banner-limite-ico">💳</div>
          <div class="banner-limite-info">
            <p class="banner-limite-titulo" style="color:#2563eb">Pagar ${Seguridad.limpiar(tc.nombre)}</p>
            <p class="banner-limite-detalle">Corte del ${Fmt.fechaCorta(ciclo.finCerradoStr)}: <strong>${Fmt.monto(ciclo.montoAPagar)}</strong></p>
          </div>
        </div>`).join('');
      alertaPago.querySelectorAll('[data-ver-tc]').forEach(el => {
        el.addEventListener('click', () => this.abrirAccionesTarjeta(el.dataset.verTc));
      });
    } else {
      alertaPago.style.display = 'none';
      alertaPago.innerHTML = '';
    }
  },

  // Igual que arriba pero solo el aviso de "día de corte", para mostrarlo
  // también dentro de la pantalla de Tarjetas.
  _renderAvisoCorteEnTarjetas() {
    const cont = document.getElementById('banner-corte-tarjetas-pantalla');
    if (!cont) return;
    const enCorteHoy = Store.getTarjetas().filter(tc => {
      const ciclo = tc.corte ? this._cicloTarjeta(tc) : null;
      return ciclo && ciclo.esHoyCorte;
    });
    if (!enCorteHoy.length) { cont.style.display='none'; cont.innerHTML=''; return; }
    const nombres = enCorteHoy.map(tc => Seguridad.limpiar(tc.nombre)).join(', ');
    cont.style.display = 'block';
    cont.style.margin = '0.75rem 1rem 1.1rem';
    cont.innerHTML = `<div class="banner-limite" style="--lim-color:#f59e0b;border-color:#f59e0b;background:#f59e0b18">
      <div class="banner-limite-ico">💳</div>
      <div class="banner-limite-info">
        <p class="banner-limite-titulo" style="color:#f59e0b">Tarjeta en día de corte</p>
        <p class="banner-limite-detalle">${nombres} — Esta tarjeta tiene su corte el día de hoy, asegúrate de revisar tus transacciones.</p>
      </div>
    </div>`;
  },

  // Muestra u oculta el aviso de "hoy es el día de corte" en el formulario
  // de nueva transacción, según la tarjeta seleccionada.
  _actualizarAdvertenciaCorte() {
    const sel = document.getElementById('t-tarjeta');
    const aviso = document.getElementById('advertencia-corte-trans');
    if (!sel || !aviso) return;
    const tcId = sel.value;
    if (!tcId) { aviso.style.display = 'none'; return; }
    const tc = Store.getTarjetas().find(t => t.id === tcId);
    const ciclo = (tc && tc.corte) ? this._cicloTarjeta(tc) : null;
    aviso.style.display = (ciclo && ciclo.esHoyCorte) ? 'block' : 'none';
  },

  renderTarjetas() {
    this._renderAvisoCorteEnTarjetas();
    const el = document.getElementById('lista-tarjetas');
    const tarjetas = Store.getTarjetas();
    if(!tarjetas.length) {
      el.innerHTML=`<div class="estado-vacio"><div class="estado-vacio-ico">💳</div><p>Sin tarjetas configuradas</p><p>Toca <strong>+</strong> para agregar una</p></div>`;
      return;
    }

    // Limpiar contenedor y crear tarjetas como elementos DOM reales
    el.innerHTML = '';
    tarjetas.forEach(tc => {
      const usado = this._deudaTarjeta(tc.id);
      const pct  = tc.limite ? Math.min(100,Math.round((usado/tc.limite)*100)) : 0;
      const disp = tc.limite ? Math.max(0,tc.limite-usado) : null;
      let estadoClass='tc-estado-ok', estadoTxt='OK';
      if(pct>=100){estadoClass='tc-estado-excedido';estadoTxt='EXCEDIDA';}
      else if(pct>=80){estadoClass='tc-estado-aviso';estadoTxt='⚠️ 80%';}

      const card = document.createElement('div');
      card.className = 'card-tc';
      card.style.background = `linear-gradient(135deg,${tc.color},${tc.color}cc)`;
      card.style.cursor = 'pointer';
      const ciclo = tc.corte ? this._cicloTarjeta(tc) : null;
      const infoCiclo = ciclo
        ? (ciclo.montoAPagar>0
            ? `<p class="tc-ciclo-info">💳 A pagar de este corte: <strong>${Fmt.monto(ciclo.montoAPagar)}</strong></p>`
            : `<p class="tc-ciclo-info">Acumulado del corte actual: <strong>${Fmt.monto(ciclo.montoAbierto)}</strong></p>`)
        : '';
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
          <p class="tc-de">${tc.limite?`de ${Fmt.monto(tc.limite)} · Disponible: ${Fmt.monto(disp)}`:'Sin límite configurado'} · <span style="opacity:.85">debes ${Fmt.monto(usado)}</span></p>
        </div>
        ${tc.limite?`<div class="tc-barra-bg"><div class="tc-barra-fill" style="width:${pct}%"></div></div>`:''}
        ${infoCiclo}
        <div class="tc-footer">
          <span class="tc-corte">${tc.corte?`Corte: día ${tc.corte}`:''}</span>
          <div class="tc-acciones">
            <button class="tc-btn btn-editar-tc">Editar</button>
            <button class="tc-btn tc-btn-del btn-eliminar-tc">Eliminar</button>
          </div>
        </div>`;

      // Listeners directos en el elemento DOM — no en HTML string
      card.querySelector('.btn-editar-tc').addEventListener('click', (e) => { e.stopPropagation(); this._editarTarjeta(tc.id); });
      card.querySelector('.btn-eliminar-tc').addEventListener('click', (e) => { e.stopPropagation(); this._confirmarEliminarTarjeta(tc.id); });
      // Tocar la tarjeta (fuera de los botones) → abrir acciones de pago
      card.addEventListener('click', () => this.abrirAccionesTarjeta(tc.id));

      el.appendChild(card);
    });
  },

  // ── Acciones de pago de tarjeta: Pagar completo / Abonar ──
  abrirAccionesTarjeta(id) {
    const tc = Store.getTarjetas().find(t=>t.id===id);
    if(!tc) return;
    tarjetaAccionId = id;
    const deuda = this._deudaTarjeta(id);
    document.getElementById('tc-acciones-titulo').textContent = Seguridad.limpiar(tc.nombre);
    document.getElementById('tc-acciones-deuda').textContent = `Debes: ${Fmt.monto(deuda)}`;
    const btnPagar = document.getElementById('btn-tc-pagar-completo');
    const btnAbonar = document.getElementById('btn-tc-abonar');
    if(btnPagar) btnPagar.disabled = deuda<=0;
    if(btnAbonar) btnAbonar.disabled = deuda<=0;
    if(deuda<=0) {
      document.getElementById('tc-acciones-deuda').textContent = 'Sin deuda pendiente en esta tarjeta ✓';
    }
    this._abrirModal('modal-tc-acciones');
  },

  pagarTarjetaCompleto() {
    const tc = Store.getTarjetas().find(t=>t.id===tarjetaAccionId);
    if(!tc) return;
    const deuda = this._deudaTarjeta(tarjetaAccionId);
    if(deuda<=0){ this.toast('✓ No tienes deuda pendiente en esta tarjeta'); return; }
    this.cerrarModal('modal-tc-acciones');
    Store.addTrans({
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      tipo:'gasto', descripcion:`Pago tarjeta: ${Seguridad.limpiar(tc.nombre)}`,
      monto:deuda, categoria:'pago_tarjeta', fecha:Fmt.hoyISO(),
      nota:'Pago completo de tarjeta', tarjetaId:'', tarjetaPagoId:tarjetaAccionId, pagado:true
    });
    App.renderActual();
    this.toast(`✓ Pagaste ${Fmt.monto(deuda)} de ${Seguridad.limpiar(tc.nombre)}`);
  },

  abrirModalAbonarTarjeta() {
    const tc = Store.getTarjetas().find(t=>t.id===tarjetaAccionId);
    if(!tc) return;
    const deuda = this._deudaTarjeta(tarjetaAccionId);
    if(deuda<=0){ this.toast('✓ No tienes deuda pendiente en esta tarjeta'); return; }
    this.cerrarModal('modal-tc-acciones');
    document.getElementById('tc-abono-titulo').textContent = `Abonar a: ${Seguridad.limpiar(tc.nombre)}`;
    document.getElementById('tc-abono-deuda').textContent = `Deuda actual: ${Fmt.monto(deuda)}`;
    document.getElementById('tc-abono-monto').value='';
    this._abrirModal('modal-tc-abono');
    setTimeout(()=>document.getElementById('tc-abono-monto').focus(),350);
  },

  confirmarAbonoTarjeta() {
    const tc = Store.getTarjetas().find(t=>t.id===tarjetaAccionId);
    if(!tc) return;
    const monto = Seguridad.limpiarNumero(document.getElementById('tc-abono-monto').value);
    if(!monto){ this.toast('⚠️ Monto inválido'); return; }
    const deuda = this._deudaTarjeta(tarjetaAccionId);
    const montoFinal = deuda>0 ? Math.min(monto, deuda) : monto;
    Store.addTrans({
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      tipo:'gasto', descripcion:`Abono a tarjeta: ${Seguridad.limpiar(tc.nombre)}`,
      monto:montoFinal, categoria:'pago_tarjeta', fecha:Fmt.hoyISO(),
      nota:'Abono a tarjeta', tarjetaId:'', tarjetaPagoId:tarjetaAccionId, pagado:true
    });
    this.cerrarModal('modal-tc-abono');
    App.renderActual();
    this.toast(`✓ Abonaste ${Fmt.monto(montoFinal)} a ${Seguridad.limpiar(tc.nombre)}`);
  },

  // Historial de movimientos de una tarjeta — como revisar el estado de
  // cuenta en la app del banco: todas las compras (cargos) y todos los
  // pagos/abonos hechos a esa tarjeta, sin importar si ya se pagaron o no.
  verHistorialTarjeta() {
    const tc = Store.getTarjetas().find(t=>t.id===tarjetaAccionId);
    if(!tc) return;
    this.cerrarModal('modal-tc-acciones');
    const todas = Store.getTrans();
    const cargos = todas.filter(t=>t.tipo==='gasto' && t.tarjetaId===tc.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    const pagos  = todas.filter(t=>t.tipo==='gasto' && t.tarjetaPagoId===tc.id).sort((a,b)=>b.fecha.localeCompare(a.fecha));

    document.getElementById('tc-hist-titulo').textContent = `📋 ${Seguridad.limpiar(tc.nombre)}`;
    const el = document.getElementById('tc-hist-lista');
    if(!cargos.length && !pagos.length) {
      el.innerHTML = `<div class="estado-vacio"><div class="estado-vacio-ico">💳</div><p>Sin movimientos todavía</p></div>`;
    } else {
      const fila = t => `<div class="tc-hist-item">
        <div class="tc-hist-info">
          <p class="tc-hist-desc">${Seguridad.limpiar(t.descripcion)}</p>
          <p class="tc-hist-fecha">${Fmt.fechaCorta(t.fecha)}</p>
        </div>
        <span class="tc-hist-monto ${t.tarjetaPagoId?'pago':'gasto'}">${t.tarjetaPagoId?'+':'-'}${Fmt.monto(t.monto)}</span>
      </div>`;
      el.innerHTML =
        (cargos.length?`<p class="tc-hist-grupo-titulo">Compras / cargos (${cargos.length})</p>${cargos.map(fila).join('')}`:'') +
        (pagos.length?`<p class="tc-hist-grupo-titulo">Pagos / abonos (${pagos.length})</p>${pagos.map(fila).join('')}`:'');
    }
    this._abrirModal('modal-tc-historial');
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
    // Notificación del sistema (si está activada) al cruzar 80% o al exceder
    this._chequearNotifLimite(excedido, pct, totalGastado, lim.monto, mes, anio);
    // Banner en inicio si excedido o cerca
    this._renderBannerLimiteInicio(excedido||pct>=80, excedido, pct, totalGastado, lim.monto);
  },

  // Envía una notificación del sistema una sola vez por umbral y por mes,
  // para no estar repitiendo el aviso cada vez que se abre la app.
  _chequearNotifLimite(excedido, pct, gastado, limite, mes, anio) {
    const cfg = Store.getConfig();
    if(!cfg.notifLimite) return;
    if(!('Notification' in window) || Notification.permission!=='granted') return;
    if(pct<80 && !excedido) return;
    const claveMes = `${anio}-${String(mes+1).padStart(2,'0')}`;
    const flags = Store._r(Store.K_NOTIF_FLAGS, {});
    flags[claveMes] = flags[claveMes] || {};
    if(excedido && !flags[claveMes].excedido) {
      new Notification('🚨 Límite mensual excedido', {
        body:`Gastaste ${Fmt.monto(gastado)} de tu límite de ${Fmt.monto(limite)} (te pasaste por ${Fmt.monto(gastado-limite)}).`,
        tag:'mf-limite', icon:'icons/icon-192.png'
      });
      flags[claveMes].excedido = true; flags[claveMes].cerca = true;
      Store._w(Store.K_NOTIF_FLAGS, flags);
    } else if(!excedido && pct>=80 && !flags[claveMes].cerca) {
      new Notification('⚠️ Cerca de tu límite mensual', {
        body:`Ya usaste el ${pct}% de tu límite (${Fmt.monto(gastado)} de ${Fmt.monto(limite)}).`,
        tag:'mf-limite', icon:'icons/icon-192.png'
      });
      flags[claveMes].cerca = true;
      Store._w(Store.K_NOTIF_FLAGS, flags);
    }
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
    this._actualizarAdvertenciaCorte();
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

  // ── Filtros avanzados de Movimientos ───────────
  abrirModalFiltros() {
    const selCat = document.getElementById('filtro-cat-select');
    const selMetodo = document.getElementById('filtro-metodo-select');
    const selTc = document.getElementById('filtro-tarjeta-select');
    if(!selCat||!selMetodo||!selTc) return;

    // Poblar categorías (gasto + ingreso, sin duplicados)
    const todasCats = [...CATS.gasto, ...CATS.ingreso].filter((c,i,arr)=>arr.findIndex(x=>x.id===c.id)===i);
    selCat.innerHTML = `<option value="todas">Todas las categorías</option>` +
      todasCats.map(c=>`<option value="${c.id}">${c.emoji} ${Seguridad.limpiar(c.nombre)}</option>`).join('');
    selCat.value = filtroCategoria;

    // Poblar tarjetas
    const tarjetas = Store.getTarjetas();
    selTc.innerHTML = `<option value="todas">Todas las tarjetas</option>` +
      tarjetas.map(t=>`<option value="${t.id}">💳 ${Seguridad.limpiar(t.nombre)}</option>`).join('');
    selTc.value = filtroTarjetaId;

    selMetodo.value = filtroMetodo;
    document.getElementById('filtro-tarjeta-row').style.display = filtroMetodo==='tarjeta' ? 'block' : 'none';

    this._abrirModal('modal-filtros-mov');
  },

  _toggleFiltroTarjetaRow() {
    const metodo = document.getElementById('filtro-metodo-select')?.value;
    const row = document.getElementById('filtro-tarjeta-row');
    if(row) row.style.display = metodo==='tarjeta' ? 'block' : 'none';
  },

  aplicarFiltrosMov() {
    filtroCategoria = document.getElementById('filtro-cat-select')?.value || 'todas';
    filtroMetodo = document.getElementById('filtro-metodo-select')?.value || 'todos';
    filtroTarjetaId = filtroMetodo==='tarjeta' ? (document.getElementById('filtro-tarjeta-select')?.value || 'todas') : 'todas';
    this.cerrarModal('modal-filtros-mov');
    this.renderTransacciones();
  },

  limpiarFiltrosMov() {
    filtroCategoria = 'todas'; filtroMetodo = 'todos'; filtroTarjetaId = 'todas';
    this.cerrarModal('modal-filtros-mov');
    this.renderTransacciones();
  },

  _hayFiltrosActivos() {
    return filtroCategoria!=='todas' || filtroMetodo!=='todos';
  },

  _actualizarBadgeFiltros() {
    const btn = document.getElementById('btn-abrir-filtros');
    const badge = document.getElementById('filtro-badge');
    const btnLimpiar = document.getElementById('btn-limpiar-filtros-inline');
    const activos = this._hayFiltrosActivos();
    let n = 0;
    if(filtroCategoria!=='todas') n++;
    if(filtroMetodo!=='todos') n++;
    if(btn) btn.classList.toggle('filtro-activo', activos);
    if(badge) { badge.style.display = activos ? 'flex' : 'none'; badge.textContent = n; }
    if(btnLimpiar) btnLimpiar.style.display = activos ? 'inline-flex' : 'none';
  },

  // ── Transacciones ─────────────────────────────
  renderTransacciones() {
    document.getElementById('mes-label').textContent=Fmt.nombreMes(mesActual,anioActual);
    let trans=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mesActual&&+y===anioActual; });
    if(filtroTipo!=='todas') trans=trans.filter(t=>t.tipo===filtroTipo);
    if(filtroCategoria!=='todas') trans=trans.filter(t=>t.categoria===filtroCategoria);
    if(filtroMetodo==='efectivo') trans=trans.filter(t=>!t.tarjetaId);
    else if(filtroMetodo==='tarjeta') {
      trans=trans.filter(t=>t.tarjetaId);
      if(filtroTarjetaId!=='todas') trans=trans.filter(t=>t.tarjetaId===filtroTarjetaId);
    }
    trans.sort((a,b)=>b.fecha.localeCompare(a.fecha));

    this._actualizarBadgeFiltros();

    // Resumen automático de lo filtrado
    const resumenEl = document.getElementById('filtro-resumen');
    if(resumenEl) {
      if(this._hayFiltrosActivos()) {
        const sumGasto = trans.filter(t=>t.tipo==='gasto').reduce((s,t)=>s+t.monto,0);
        const sumIngreso = trans.filter(t=>t.tipo==='ingreso').reduce((s,t)=>s+t.monto,0);
        let partes = '';
        if(filtroTipo!=='ingreso') partes += `<div class="filtro-resumen-item"><span class="filtro-resumen-label">Gastado</span><span class="filtro-resumen-valor gas">${Fmt.monto(sumGasto)}</span></div>`;
        if(filtroTipo!=='gasto') partes += `<div class="filtro-resumen-item"><span class="filtro-resumen-label">Ingresado</span><span class="filtro-resumen-valor ing">${Fmt.monto(sumIngreso)}</span></div>`;
        partes += `<div class="filtro-resumen-item"><span class="filtro-resumen-label">Movimientos</span><span class="filtro-resumen-valor">${trans.length}</span></div>`;
        resumenEl.innerHTML = partes;
        resumenEl.style.display = 'flex';
      } else {
        resumenEl.style.display = 'none';
      }
    }

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
      cont.querySelectorAll('.btn-hist-del').forEach(btn=>{ btn.addEventListener('click',()=>{
        this.confirmar(`¿Eliminar historial de ${btn.dataset.clave}?`, () => {
          Store.delHistorialMes(btn.dataset.clave); this.renderHistorial(); this.toast('Eliminado');
        });
      }); });
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
    this._actualizarAvatarUI(cfg);
    const elN=document.getElementById('perfil-nombre-txt');
    if(elN) elN.textContent=nombre||'Mi Cuenta';
    const pNombre=document.getElementById('p-nombre');
    if(pNombre) pNombre.value=nombre;
    const pOscuro=document.getElementById('cfg-oscuro');
    if(pOscuro) pOscuro.checked=!!cfg.oscuro;
    const pNotif=document.getElementById('cfg-notif-limite');
    if(pNotif) pNotif.checked=!!cfg.notifLimite;
    this._actualizarTextoNotif();
    this.renderTemasGrid(cfg.tema||'verde');
  },

  // Pinta el avatar: la foto guardada si existe, o la inicial del nombre.
  // Actualiza tanto el avatar grande de Perfil como el ícono circular de Inicio.
  _actualizarAvatarUI(cfg) {
    const avatar = document.getElementById('perfil-avatar');
    const btnQuitar = document.getElementById('btn-quitar-foto');
    if (avatar) {
      if (cfg.foto) {
        avatar.style.backgroundImage = `url(${cfg.foto})`;
        avatar.textContent = '';
        if (btnQuitar) btnQuitar.style.display = 'block';
      } else {
        avatar.style.backgroundImage = 'none';
        const nombre = Seguridad.limpiar(cfg.nombre) || '';
        avatar.textContent = nombre ? nombre[0].toUpperCase() : 'M';
        if (btnQuitar) btnQuitar.style.display = 'none';
      }
    }

    const btnInicio = document.getElementById('btn-avatar-inicio');
    const icoInicio = document.getElementById('btn-avatar-inicio-ico');
    if (btnInicio) {
      if (cfg.foto) {
        btnInicio.style.backgroundImage = `url(${cfg.foto})`;
        btnInicio.style.backgroundSize = 'cover';
        btnInicio.style.backgroundPosition = 'center';
        if (icoInicio) icoInicio.style.display = 'none';
      } else {
        btnInicio.style.backgroundImage = 'none';
        if (icoInicio) icoInicio.style.display = 'block';
      }
    }
  },

  // Lee el archivo elegido, lo recorta a un cuadro y lo comprime antes de
  // guardarlo (así no se llena el almacenamiento local con fotos pesadas).
  subirFotoPerfil(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.toast('⚠️ Selecciona una imagen válida'); event.target.value=''; return; }

    const lector = new FileReader();
    lector.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const tam = 300;
        const canvas = document.createElement('canvas');
        canvas.width = tam; canvas.height = tam;
        const ctx = canvas.getContext('2d');
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tam, tam);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const cfg = Store.getConfig();
        cfg.foto = dataUrl;
        Store.setConfig(cfg);
        this._actualizarAvatarUI(cfg);
        this.toast('✓ Foto de perfil actualizada');
      };
      img.onerror = () => this.toast('⚠️ No se pudo cargar la imagen');
      img.src = e.target.result;
    };
    lector.onerror = () => this.toast('⚠️ No se pudo leer el archivo');
    lector.readAsDataURL(file);
    event.target.value = '';
  },

  quitarFotoPerfil() {
    const cfg = Store.getConfig();
    delete cfg.foto;
    Store.setConfig(cfg);
    this._actualizarAvatarUI(cfg);
    this.toast('Foto eliminada');
  },

  _actualizarTextoNotif() {
    const txt = document.getElementById('notif-estado-txt');
    if(!txt) return;
    if(!('Notification' in window)) {
      txt.textContent = 'Tu navegador no soporta notificaciones.';
    } else if(Notification.permission==='denied') {
      txt.textContent = '🚫 Bloqueaste las notificaciones para este sitio. Actívalas desde los ajustes del navegador para usar esta opción.';
    } else {
      txt.textContent = 'Te avisamos con una notificación cuando estés cerca de tu límite mensual (80%) y cuando lo superes.';
    }
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
    const icoEmoji = t.emoji || cat.emoji;
    const bg=t.tipo==='ingreso'?'var(--ingreso-bg)':'var(--gasto-bg)';
    const nota=t.nota?' · '+Seguridad.limpiar(t.nota):'';
    const autoTag=t.automatico?'<span style="font-size:10px;background:var(--acento-light);color:var(--acento-texto);padding:1px 6px;border-radius:10px;margin-left:4px">Auto</span>':'';
    const tc = t.tarjetaId ? Store.getTarjetas().find(x=>x.id===t.tarjetaId) : null;
    const tcBadge = tc ? `<span class="metodo-pago-badge" style="background:${tc.color}22;color:${tc.color}">💳 ${Seguridad.limpiar(tc.nombre)}</span>` : '';
    return `<div class="item-trans"><div class="item-ico" style="background:${bg}">${icoEmoji}</div><div class="item-info"><p class="item-desc">${Seguridad.limpiar(t.descripcion)}${autoTag}${tcBadge}</p><p class="item-sub">${cat.nombre}${nota}</p></div><div class="item-der"><p class="item-monto-val ${t.tipo}">${signo} ${Fmt.monto(t.monto)}</p><p class="item-fecha-val">${Fmt.fechaCorta(t.fecha)}</p></div><button class="item-del" data-id="${t.id}" aria-label="Eliminar">✕</button></div>`;
  },

  _bindDel(el) {
    el.querySelectorAll('.item-del').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id = btn.dataset.id;
        const t = Store.getTrans().find(x => x.id === id);
        if (!t) return;
        if (t.recurrenteId || t.cuotaId) {
          this._abrirEliminarVinculado(t);
          return;
        }
        this.confirmar('¿Eliminar esta transacción?', () => {
          Store.delTrans(id);
          App.renderActual();
          this.toast('Transacción eliminada');
        });
      });
    });
  },

  // Cuando el pago que se quiere borrar viene de un servicio recurrente o de
  // una compra a cuotas, se pregunta si es un error (debe volver a aparecer
  // como pendiente) o si se quiere eliminar ese servicio/cuota por completo.
  // _datosEliminarVinculado guarda { tipo:'transaccion'|'pendiente', obj }
  _datosEliminarVinculado: null,

  _abrirEliminarVinculado(t) {
    this._datosEliminarVinculado = { tipo:'transaccion', obj:t };
    const esCuota = !!t.cuotaId;
    const texto = document.getElementById('elim-vinc-texto');
    if (texto) texto.textContent = esCuota
      ? 'Este pago pertenece a una compra a cuotas. ¿Qué quieres hacer?'
      : 'Este pago pertenece a un servicio recurrente. ¿Qué quieres hacer?';
    const btnDeshacer = document.getElementById('btn-elim-vinc-deshacer');
    if (btnDeshacer) btnDeshacer.textContent = 'Solo deshacer este pago';
    const btnCompleto = document.getElementById('btn-elim-vinc-completo');
    if (btnCompleto) btnCompleto.textContent = esCuota
      ? 'Eliminar la cuota por completo'
      : 'Eliminar el servicio por completo';
    this._abrirModal('modal-eliminar-vinculado');
  },

  // Igual que arriba, pero para una tarea aún NO pagada (desde las alertas
  // de "Pendientes"). También permite eliminar el servicio/cuota de raíz.
  _abrirEliminarPendienteVinculado(p) {
    this._datosEliminarVinculado = { tipo:'pendiente', obj:p };
    const esCuota = !!p.cuotaId;
    const texto = document.getElementById('elim-vinc-texto');
    if (texto) texto.textContent = esCuota
      ? 'Esta tarea pertenece a una compra a cuotas. ¿Qué quieres hacer?'
      : 'Esta tarea pertenece a un servicio recurrente. ¿Qué quieres hacer?';
    const btnDeshacer = document.getElementById('btn-elim-vinc-deshacer');
    if (btnDeshacer) btnDeshacer.textContent = 'Solo ocultar este mes';
    const btnCompleto = document.getElementById('btn-elim-vinc-completo');
    if (btnCompleto) btnCompleto.textContent = esCuota
      ? 'Eliminar la cuota por completo'
      : 'Eliminar el servicio por completo';
    this._abrirModal('modal-eliminar-vinculado');
  },

  // Solo deshace ESTE pago/tarea puntual, sin tocar el servicio/cuota:
  // - Si ya estaba pagado: borra la transacción y el pendiente vuelve a aparecer.
  // - Si aún no estaba pagado: solo se oculta este mes (vuelve el próximo).
  eliminarVinculadoDeshacer() {
    const d = this._datosEliminarVinculado;
    if (!d) return;
    this.cerrarModal('modal-eliminar-vinculado');

    if (d.tipo === 'pendiente') {
      const p = d.obj;
      Store.setPendientes(Store.getPendientes().map(x => x.id===p.id ? {...x, oculto:true} : x));
      this._datosEliminarVinculado = null;
      App.renderActual();
      this.toast('🗑️ Oculto este mes — el próximo vuelve a aparecer');
      return;
    }

    const t = d.obj;
    Store.delTrans(t.id);

    const [y,m] = t.fecha.split('-');
    const claveMes = `${y}-${m}`;
    let pendientes = Store.getPendientes();

    if (t.cuotaId) {
      Store.setCuotas(Store.getCuotas().map(c =>
        c.id === t.cuotaId ? {...c, cuotasPagadas: Math.max(0, c.cuotasPagadas-1), activo:true} : c
      ));
      const existe = pendientes.find(p => p.cuotaId === t.cuotaId && p.claveMes === claveMes);
      if (existe) {
        pendientes = pendientes.map(p => p.id===existe.id ? {...p, pagado:false, oculto:false} : p);
      } else {
        pendientes.push({
          id:'pend_cuota_'+t.cuotaId+'_'+claveMes, cuotaId:t.cuotaId, claveMes,
          descripcion:t.descripcion, monto:t.monto, categoria:t.categoria,
          emoji:t.emoji||'', fechaVence:t.fecha, pagado:false, prioridad:true, tarjetaId:''
        });
      }
    } else if (t.recurrenteId) {
      const existe = pendientes.find(p => p.recurrenteId === t.recurrenteId && p.claveMes === claveMes);
      if (existe) {
        pendientes = pendientes.map(p => p.id===existe.id ? {...p, pagado:false, oculto:false} : p);
      } else {
        pendientes.push({
          id:'pend_'+t.recurrenteId+'_'+claveMes, recurrenteId:t.recurrenteId, claveMes,
          descripcion:t.descripcion, monto:t.monto, categoria:t.categoria,
          fechaVence:t.fecha, pagado:false, prioridad:true, tarjetaId:t.tarjetaId||''
        });
      }
    }
    Store.setPendientes(pendientes);
    Store.sincronizarFijosPresupuesto();

    this._datosEliminarVinculado = null;
    App.renderActual();
    this.toast('↩️ Pago deshecho — vuelve a aparecer como pendiente');
  },

  // Elimina el servicio recurrente o la compra a cuotas por completo:
  // borra este pago/tarea y hace que ya no vuelva a generarse en meses futuros.
  eliminarVinculadoCompleto() {
    const d = this._datosEliminarVinculado;
    if (!d) return;
    this.cerrarModal('modal-eliminar-vinculado');
    const obj = d.obj;

    if (d.tipo === 'transaccion') Store.delTrans(obj.id);

    if (obj.cuotaId) {
      Store.setCuotas(Store.getCuotas().filter(c => c.id !== obj.cuotaId));
      Store.setPendientes(Store.getPendientes().filter(p => p.cuotaId !== obj.cuotaId));
      this.toast('🗑️ Compra a cuotas eliminada por completo');
    } else if (obj.recurrenteId) {
      Store.setRecurrentes(Store.getRecurrentes().map(r => r.id===obj.recurrenteId ? {...r, activo:false} : r));
      Store.setPendientes(Store.getPendientes().filter(p => !(p.recurrenteId===obj.recurrenteId && !p.pagado)));
      this.toast('🗑️ Servicio eliminado — no volverá a aparecer');
    }
    Store.sincronizarFijosPresupuesto();

    this._datosEliminarVinculado = null;
    App.renderActual();
  },

  // ── Modal transacción ─────────────────────────
  abrirModalTrans() {
    document.getElementById('t-fecha').value=Fmt.hoyISO();
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
    // Selector de salida/evento
    this._actualizarSelectorEvento();
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
    const esServicioGasto = ((cat === 'servicios' || cat === 'gastos_recurrentes') && tipoModal === 'gasto');
    // Panel recurrente: solo en servicios / gastos recurrentes
    panelRec.style.display  = esServicioGasto ? 'block' : 'none';
    // Panel pendiente: en gastos que NO sean servicios / gastos recurrentes
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
    if((cat==='servicios'||cat==='gastos_recurrentes')&&tipoModal==='gasto') {
      const esRecurrente=document.getElementById('t-es-recurrente')?.checked||false;
      const diaRec=Math.min(28,Math.max(1,parseInt(document.getElementById('t-dia-recurrente')?.value)||1));
      const tarjetaIdServicio = document.getElementById('t-tarjeta')?.value || '';
      // Guardar datos temporalmente y abrir modal de confirmación
      this._datosPendientesServicio={desc,monto,cat,fecha,nota,esRecurrente,diaRec,tarjetaId:tarjetaIdServicio};
      this.cerrarModal('modal-trans');
      this._abrirModal('modal-servicio-pago');
      document.getElementById('servicio-pago-nombre').textContent=desc;
      document.getElementById('servicio-pago-monto').textContent=Fmt.monto(monto);
      return;
    }

    // Leer tarjeta y salida seleccionadas
    const tarjetaId = document.getElementById('t-tarjeta')?.value || '';
    const eventoId  = document.getElementById('t-evento')?.value || '';

    // Si es gasto → verificar límite mensual
    if(tipoModal==='gasto' && !esPendiente) {
      this._verificarLimite(monto, ()=>{
        this._finalizarGuardadoTrans({desc,monto,cat,fecha,nota,esPendiente,tarjetaId,eventoId});
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
        fechaVence:fecha, pagado:false, prioridad:true, recurrenteId:null,
        tarjetaId: tarjetaId||'', eventoId: eventoId||''
      });
      Store.setPendientes(pends);
      this.cerrarModal('modal-trans');
      App.renderActual();
      this.toast('🔴 Guardado como pendiente — no descuenta hasta que lo pagues');
      return;
    }

    // Gasto o ingreso normal → registrar directo
    this._finalizarGuardadoTrans({desc,monto,cat,fecha,nota,esPendiente:false,tarjetaId:'',eventoId:''});
  },

  _finalizarGuardadoTrans({desc,monto,cat,fecha,nota,esPendiente,tarjetaId,eventoId}) {
    // Verificar límite de tarjeta si se seleccionó una
    if(tarjetaId && tipoModal==='gasto' && !esPendiente) {
      const tc = Store.getTarjetas().find(t=>t.id===tarjetaId);
      if(tc && tc.limite>0) {
        const usadoTC = this._deudaTarjeta(tarjetaId);
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
            this._registrarTransaccionFinal({desc,monto,cat,fecha,nota,pagado:true,prioridad:false,tarjetaId,eventoId});
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
      pends.push({id:'pend_manual_'+Date.now().toString(36),claveMes,descripcion:desc,monto,categoria:cat,fechaVence:fecha,pagado:false,prioridad:true,recurrenteId:null,tarjetaId:tarjetaId||'',eventoId:eventoId||''});
      Store.setPendientes(pends);
      this.cerrarModal('modal-trans');
      App.renderActual();
      this.toast('🔴 Guardado como pendiente — no descuenta hasta que lo pagues');
      return;
    }
    this._registrarTransaccionFinal({desc,monto,cat,fecha,nota,pagado:true,prioridad:false,tarjetaId,eventoId});
  },

  _registrarTransaccionFinal({desc,monto,cat,fecha,nota,pagado,prioridad,tarjetaId,recurrenteId,eventoId}) {
    const t={
      id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      tipo:tipoModal,descripcion:desc,monto,categoria:cat,fecha,nota,
      prioridad:prioridad||false, pagado:pagado!==false,
      tarjetaId: tarjetaId||'', recurrenteId: recurrenteId||null, eventoId: eventoId||null
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

    // Si es recurrente → guardar/ubicar en la lista PRIMERO, para poder
    // enlazar el pendiente con su recurrenteId y que no se duplique
    // cuando Store.generarPendientesMes() vuelva a correr.
    let recurrenteId = null;
    if(d.esRecurrente) {
      const recurrentes=Store.getRecurrentes();
      const existente=recurrentes.find(r=>r.descripcion===d.desc&&r.categoria===d.cat);
      if(existente) {
        // Puede existir pero estar desactivado (si antes se "eliminó por
        // completo") — al volver a crearlo hay que reactivarlo y refrescar
        // sus datos, si no, se queda invisible para siempre aunque el
        // usuario crea que lo agregó de nuevo.
        recurrenteId = existente.id;
        Store.setRecurrentes(recurrentes.map(r => r.id===existente.id
          ? {...r, activo:true, monto:d.monto, dia:d.diaRec, tarjetaId:d.tarjetaId||''}
          : r
        ));
      } else {
        recurrenteId = 'rec_'+Date.now().toString(36);
        recurrentes.push({
          id:recurrenteId,
          descripcion:d.desc, monto:d.monto, categoria:d.cat,
          dia:d.diaRec, activo:true, prioridad:false,
          tarjetaId: d.tarjetaId||''
        });
        Store.setRecurrentes(recurrentes);
      }
      Store.sincronizarFijosPresupuesto();
    }

    if(yaPagado) {
      // Registrar como gasto normal (descuenta del saldo)
      tipoModal='gasto';
      // Si hay un pendiente activo de este recurrente en este mes, marcarlo como pagado
      const hoyP=new Date(), mesP=hoyP.getMonth(), anioP=hoyP.getFullYear();
      const claveMesP=`${anioP}-${String(mesP+1).padStart(2,'0')}`;
      const pends=Store.getPendientes().map(p => {
        const coincide = recurrenteId ? p.recurrenteId===recurrenteId : p.descripcion===d.desc;
        if(p.claveMes===claveMesP && coincide && !p.pagado)
          return {...p, pagado:true};
        return p;
      });
      Store.setPendientes(pends);
      this._registrarTransaccionFinal({desc:d.desc,monto:d.monto,cat:d.cat,fecha:d.fecha,nota:'Pago automático',pagado:true,tarjetaId:d.tarjetaId||'',recurrenteId});
    } else {
      // Registrar como pendiente (NO descuenta del saldo)
      const hoy2=new Date(), mes2=hoy2.getMonth(), anio2=hoy2.getFullYear();
      const claveMes=`${anio2}-${String(mes2+1).padStart(2,'0')}`;
      // Verificar que no exista ya un pendiente para este servicio este mes
      const pendExiste = Store.getPendientes().some(p => {
        const coincide = recurrenteId ? p.recurrenteId===recurrenteId : p.descripcion===d.desc;
        return p.claveMes===claveMes && coincide && !p.pagado;
      });
      if(!pendExiste) {
        const pends=Store.getPendientes();
        pends.push({
          id: recurrenteId ? ('pend_'+recurrenteId+'_'+claveMes) : ('pend_serv_'+Date.now().toString(36)),
          claveMes, descripcion:d.desc, monto:d.monto, categoria:d.cat,
          fechaVence:d.fecha, pagado:false, prioridad:true, recurrenteId,
          tarjetaId: d.tarjetaId||''
        });
        Store.setPendientes(pends);
      }
      this.toast('🔴 Pendiente de pago — aparecerá en alertas');
      App.renderActual();
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
      // Flujo de confirmación de hasta 3 pasos
      this.confirmar(`⚠️ Vas a cambiar el salario\n\nAnterior: ${Fmt.monto(anterior)}\nNuevo: ${Fmt.monto(nuevoMonto)}\n\n¿Estás seguro?`, () => {
        const hayTrans=Store.getTrans().some(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===new Date().getMonth()&&+y===new Date().getFullYear(); });
        if(!hayTrans) {
          this._aplicarNuevoSalario(nuevoMonto, dia, auto);
          return;
        }
        this.confirmar(`📅 El mes actual ya tiene transacciones.\n\n¿Deseas reiniciar (archivar) el mes actual?\n\n• Aceptar → archiva el mes y empieza de cero\n• Cancelar → solo cambia el salario, el mes no se toca`, () => {
          this.confirmar(`⚠️ ÚLTIMA CONFIRMACIÓN\n\n¿Ya descargaste el reporte en PDF?\n\n• Aceptar → Sí, continuar\n• Cancelar → No, quiero descargar primero`, () => {
            Store.cerrarMes(new Date().getMonth(),new Date().getFullYear());
            // Resetear marcador de sueldo aplicado este mes
            const claveMes=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
            Store.setSApl(Store.getSApl().filter(k=>k!==claveMes));
            this.toast('✓ Mes archivado');
            this._aplicarNuevoSalario(nuevoMonto, dia, auto);
          }, 'Sí, continuar', () => {
            // No ha descargado el reporte todavía: se lo descargamos y NO
            // se aplica el cambio de salario ni se archiva el mes todavía.
            const mes=new Date().getMonth(), anio=new Date().getFullYear();
            const transMes=Store.getTrans().filter(t=>{ const[y,m]=t.fecha.split('-'); return +m-1===mes&&+y===anio; });
            if(transMes.length) PDF.generar({transacciones:transMes,nombre:Fmt.nombreMes(mes,anio)});
            this.toast('📄 Descargando reporte. Intenta de nuevo después.');
          });
        }, 'Archivar', () => {
          // No quiere archivar: aplica el salario nuevo sin tocar el mes actual.
          this._aplicarNuevoSalario(nuevoMonto, dia, auto);
        });
      }, 'Continuar', () => {
        this.toast('Cambio cancelado');
      });
      return;
    }

    this._aplicarNuevoSalario(nuevoMonto, dia, auto);
  },

  _aplicarNuevoSalario(nuevoMonto, dia, auto) {
    // Aplicar el nuevo salario en config
    const cfg=Store.getConfig();
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

  // Marca un pendiente como pagado, crea la transacción real y, si viene
  // de una compra a cuotas, suma el progreso de esa cuota. Compartido entre
  // las alertas de "Pendientes" y la pantalla de "Cuotas".
  _pagarPendiente(pendId) {
    const pend = Store.getPendientes().find(p => p.id === pendId);
    if (!pend || pend.pagado) return; // ya pagado, ignorar

    Store.setPendientes(Store.getPendientes().map(p =>
      p.id === pendId ? {...p, pagado:true} : p
    ));
    // Crear transacción real — si el pendiente se creó con tarjeta,
    // se registra como cargo a esa tarjeta (no descuenta efectivo);
    // si no, se descuenta del saldo/efectivo como antes.
    Store.addTrans({
      id: Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      tipo:'gasto', descripcion:pend.descripcion, monto:pend.monto,
      categoria:pend.categoria, fecha:Fmt.hoyISO(),
      nota: pend.cuotaId ? 'Pago de cuota' : 'Pago de pendiente', pagado:true, prioridad:false,
      tarjetaId: pend.tarjetaId || '', emoji: pend.emoji || '',
      cuotaId: pend.cuotaId || null, recurrenteId: pend.recurrenteId || null,
      eventoId: pend.eventoId || null
    });

    const tc = pend.tarjetaId ? Store.getTarjetas().find(t=>t.id===pend.tarjetaId) : null;
    let mensaje = tc ? `✓ Cargado a ${tc.nombre}` : '✓ Marcado como pagado';
    if (pend.cuotaId) {
      const completada = this._marcarCuotaPagada(pend.cuotaId);
      mensaje = completada ? '🎉 ¡Terminaste de pagar esa compra a cuotas!' : '✓ Cuota pagada';
    }
    App.renderActual();
    this.toast(mensaje);
  },

  // Suma un pago al progreso de una compra a cuotas. Devuelve true si con
  // este pago se completaron todas las cuotas.
  _marcarCuotaPagada(cuotaId) {
    let completada = false;
    const cuotas = Store.getCuotas().map(c => {
      if (c.id !== cuotaId) return c;
      const pagadas = c.cuotasPagadas + 1;
      completada = pagadas >= c.cuotasTotales;
      return {...c, cuotasPagadas: pagadas, activo: !completada};
    });
    Store.setCuotas(cuotas);
    Store.sincronizarFijosPresupuesto();
    return completada;
  },

  // ── Compras a cuotas ──────────────────────────
  renderCuotas() {
    Store.generarPendientesCuotas();
    const el = document.getElementById('lista-cuotas');
    if (!el) return;
    const cuotas = Store.getCuotas();
    if (!cuotas.length) {
      el.innerHTML = `<div class="estado-vacio"><div class="estado-vacio-ico">🧾</div><p>Sin compras a cuotas</p><p>Toca <strong>+</strong> para agregar una</p></div>`;
      return;
    }
    const hoy = new Date();
    const claveMes = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
    const pendientes = Store.getPendientes();

    el.innerHTML = cuotas.map(c => {
      const pct = Math.min(100, Math.round((c.cuotasPagadas / c.cuotasTotales) * 100));
      const terminada = c.cuotasPagadas >= c.cuotasTotales;
      const pendMes = pendientes.find(p => p.cuotaId === c.id && p.claveMes === claveMes && !p.pagado && !p.oculto);
      let accionHtml;
      if (terminada) {
        accionHtml = `<span class="btn-meta-accion" style="background:var(--acento-light);color:var(--acento-texto)">✓ Completada</span>`;
      } else if (pendMes) {
        accionHtml = `<button class="btn-meta-accion btn-abonar" data-pagar-cuota="${c.id}">Pagar cuota de este mes</button>`;
      } else {
        accionHtml = `<span class="btn-meta-accion" style="background:var(--fondo);color:var(--texto3)">Ya pagada este mes</span>`;
      }
      return `<div class="card-meta">
        <div class="meta-header">
          <div class="meta-titulo"><span class="meta-emoji">${c.emoji||'🧾'}</span><span>${Seguridad.limpiar(c.descripcion)}</span></div>
          <span class="meta-pct">${pct}%</span>
        </div>
        <div class="meta-barra-bg"><div class="meta-barra-fill" style="width:${pct}%"></div></div>
        <div class="meta-nums">
          <span>Cuota: <strong>${Fmt.monto(c.montoCuota)}</strong></span>
          <span>Progreso: <strong>${c.cuotasPagadas}/${c.cuotasTotales}</strong></span>
        </div>
        <p style="font-size:12.5px;color:var(--texto2);margin:4px 0 2px;font-weight:600">Total: ${Fmt.monto(c.montoCuota*c.cuotasTotales)}</p>
        <p style="font-size:12px;color:var(--texto3);margin:0 0 8px">Vence el día ${c.dia} de cada mes</p>
        <div class="meta-acciones">
          ${accionHtml}
          <button class="btn-meta-accion btn-eliminar-meta" data-eliminar-cuota="${c.id}">Eliminar</button>
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('[data-pagar-cuota]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cuotaId = btn.dataset.pagarCuota;
        const pend = Store.getPendientes().find(p => p.cuotaId === cuotaId && p.claveMes === claveMes && !p.pagado);
        if (pend) this._pagarPendiente(pend.id);
      });
    });
    el.querySelectorAll('[data-eliminar-cuota]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.eliminarCuota;
        this.confirmar('¿Eliminar esta compra a cuotas? Los pagos ya realizados no se borran, pero dejará de generarse cada mes.', () => {
          Store.setCuotas(Store.getCuotas().filter(c => c.id !== id));
          // Quitar también el pendiente sin pagar de este mes, si existe
          Store.setPendientes(Store.getPendientes().filter(p => !(p.cuotaId === id && !p.pagado)));
          Store.sincronizarFijosPresupuesto();
          this.renderCuotas();
          this.toast('🗑️ Compra a cuotas eliminada');
        });
      });
    });
  },

  abrirModalCuota() {
    document.getElementById('cu-desc').value='';
    document.getElementById('cu-monto').value='';
    document.getElementById('cu-total').value='';
    document.getElementById('cu-dia').value=Math.min(28,new Date().getDate());
    document.getElementById('cu-emoji').value='';
    const chkPagado=document.getElementById('cu-ya-pagado'); if(chkPagado) chkPagado.checked=false;
    const filaPagadas=document.getElementById('cu-pagadas-row'); if(filaPagadas) filaPagadas.style.display='none';
    document.getElementById('cu-pagadas').value='';
    const zonaErr = document.getElementById('zona-error-cuota');
    if (zonaErr) zonaErr.innerHTML = '';
    this._abrirModal('modal-cuota');
    setTimeout(()=>document.getElementById('cu-desc').focus(),350);
  },

  guardarCuota() {
    const desc  = Seguridad.limpiar(document.getElementById('cu-desc').value);
    const monto = Seguridad.limpiarNumero(document.getElementById('cu-monto').value);
    const totalRaw = parseInt(document.getElementById('cu-total').value);
    const total = Math.min(60, Math.max(2, isNaN(totalRaw) ? 0 : totalRaw));
    const dia   = Math.min(28, Math.max(1, parseInt(document.getElementById('cu-dia').value) || 1));
    const emoji = Seguridad.limpiarEmoji(document.getElementById('cu-emoji').value || '') || '🧾';

    if(!desc)  { this.toast('⚠️ Escribe qué compraste'); return; }
    if(!monto) { this.toast('⚠️ Ingresa el monto de cada cuota'); return; }
    if(!totalRaw || totalRaw < 2) { this.toast('⚠️ Deben ser al menos 2 cuotas'); return; }

    // Si el usuario indicó que ya había pagado cuotas antes de registrarla
    const yaPagado = document.getElementById('cu-ya-pagado')?.checked || false;
    let cuotasPagadas = 0;
    if (yaPagado) {
      const pagadasRaw = parseInt(document.getElementById('cu-pagadas').value);
      cuotasPagadas = Math.min(total-1, Math.max(0, isNaN(pagadasRaw) ? 0 : pagadasRaw));
    }

    // Guardamos los datos ya validados y preguntamos, en un segundo paso,
    // cuándo debe empezar a aparecer.
    this._datosCuotaPendiente = { desc, monto, total, dia, emoji, cuotasPagadas };
    this.cerrarModal('modal-cuota');
    this._abrirModal('modal-cuota-inicio');
  },

  finalizarGuardarCuota(inicioSel) {
    const d = this._datosCuotaPendiente;
    if (!d) return;
    this.cerrarModal('modal-cuota-inicio');

    const hoy = new Date();
    let mesInicio;
    if (inicioSel === 'siguiente') {
      const nd = new Date(hoy.getFullYear(), hoy.getMonth()+1, 1);
      mesInicio = `${nd.getFullYear()}-${String(nd.getMonth()+1).padStart(2,'0')}`;
    } else {
      mesInicio = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
    }

    const cuotas = Store.getCuotas();
    cuotas.push({
      id: 'cuota_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      descripcion: d.desc, montoCuota: d.monto, categoria: 'cuotas', emoji: d.emoji,
      cuotasTotales: d.total, cuotasPagadas: d.cuotasPagadas, dia: d.dia, activo: true, mesInicio,
      fechaCreacion: Fmt.hoyISO()
    });
    Store.setCuotas(cuotas);
    Store.generarPendientesCuotas();
    Store.sincronizarFijosPresupuesto();

    this._datosCuotaPendiente = null;
    App.renderActual();
    const mensajeInicio = inicioSel === 'siguiente' ? ' — empieza el próximo mes' : '';
    this.toast(`✓ "${d.desc}" registrada — ${d.total} cuotas de ${Fmt.monto(d.monto)}${mensajeInicio}`);
  },

  // ── Salidas / presupuesto por evento ───────────
  _salidaExpandida: null,

  renderSalidas() {
    const el = document.getElementById('lista-salidas');
    if (!el) return;
    const eventos = Store.getEventos();
    if (!eventos.length) {
      el.innerHTML = `<div class="estado-vacio"><div class="estado-vacio-ico">🎉</div><p>Sin salidas registradas</p><p>Toca <strong>+</strong> para ponerle límite a tu próxima salida</p></div>`;
      return;
    }

    el.innerHTML = eventos.map(ev => {
      const gastado = Store.gastadoEvento(ev.id);
      const restante = ev.limite - gastado;
      const pct = ev.limite>0 ? Math.min(100, Math.round((gastado/ev.limite)*100)) : 0;
      const excedido = restante < 0;
      const terminada = !ev.activo;
      const transEvento = Store.getTrans()
        .filter(t=>t.tipo==='gasto' && t.eventoId===ev.id)
        .sort((a,b)=> b.fecha.localeCompare(a.fecha));
      const expandida = this._salidaExpandida === ev.id;

      const detalle = expandida ? `
        <div class="salida-detalle">
          ${transEvento.length
            ? transEvento.map(t=>{
                const cat=getCat(t.categoria);
                return `<div class="salida-item">
                  <span class="salida-item-ico">${t.emoji||cat.emoji}</span>
                  <span class="salida-item-desc">${Seguridad.limpiar(t.descripcion)}</span>
                  <span class="salida-item-monto">${Fmt.monto(t.monto)}</span>
                </div>`;
              }).join('')
            : `<p class="salida-item-vacio">Todavía no hay gastos registrados en esta salida.</p>`}
        </div>
        <div class="meta-acciones" style="margin-top:8px">
          <button class="btn-meta-accion" style="background:#2563eb18;color:#2563eb" data-pdf-salida="${ev.id}">📄 Descargar PDF</button>
          <button class="btn-meta-accion btn-eliminar-meta" data-eliminar-salida="${ev.id}">Eliminar</button>
        </div>` : '';

      return `<div class="card-meta" id="salida-card-${ev.id}">
        <div class="meta-header">
          <div class="meta-titulo"><span class="meta-emoji">${ev.emoji||'🎉'}</span><span>${Seguridad.limpiar(ev.nombre)}</span></div>
          <span class="meta-pct" style="${excedido?'color:var(--gasto)':''}">${pct}%</span>
        </div>
        <div class="meta-barra-bg"><div class="meta-barra-fill" style="width:${pct}%;${excedido?'background:var(--gasto)':''}"></div></div>
        <div class="meta-nums">
          <span>Límite: <strong>${Fmt.monto(ev.limite)}</strong></span>
          <span>Gastado: <strong style="${excedido?'color:var(--gasto)':''}">${Fmt.monto(gastado)}</strong></span>
        </div>
        <p style="font-size:12px;color:${excedido?'var(--gasto)':'var(--texto3)'};margin:2px 0 8px;font-weight:${excedido?'600':'400'}">${excedido?`⚠️ Te pasaste por ${Fmt.monto(Math.abs(restante))}`:`Te quedan ${Fmt.monto(restante)}`}${ev.fecha?` · ${Fmt.fechaCorta(ev.fecha)}`:''}${terminada?' · <strong>Finalizada</strong>':''}</p>
        ${detalle}
        <div class="meta-acciones">
          <button class="btn-meta-accion btn-abonar" data-ver-salida="${ev.id}">${expandida?'Ocultar detalles':'Ver más detalles'}</button>
          ${terminada
            ? `<span class="btn-meta-accion" style="background:var(--fondo);color:var(--texto3)">✓ Finalizada</span>`
            : `<button class="btn-meta-accion" style="background:var(--acento-light);color:var(--acento-texto)" data-terminar-salida="${ev.id}">Terminar</button>`}
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('[data-ver-salida]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.verSalida;
        this._salidaExpandida = (this._salidaExpandida === id) ? null : id;
        this.renderSalidas();
      });
    });
    el.querySelectorAll('[data-terminar-salida]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.terminarSalida;
        this.confirmar('¿Marcar esta salida como terminada? Ya no vas a poder agregarle más gastos, pero su historial se conserva aquí.', () => {
          Store.setEventos(Store.getEventos().map(e => e.id===id ? {...e, activo:false} : e));
          this.renderSalidas();
          this._actualizarSelectorEvento();
          this.toast('✓ Salida marcada como terminada');
        }, 'Terminar');
      });
    });
    el.querySelectorAll('[data-pdf-salida]').forEach(btn=>{
      btn.addEventListener('click', ()=> this.descargarPdfSalida(btn.dataset.pdfSalida));
    });
    el.querySelectorAll('[data-eliminar-salida]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.dataset.eliminarSalida;
        this.confirmar('¿Eliminar esta salida? Los gastos ya registrados no se borran, solo dejan de estar agrupados aquí.', () => {
          Store.setEventos(Store.getEventos().filter(e=>e.id!==id));
          Store.setTrans(Store.getTrans().map(t=> t.eventoId===id ? {...t, eventoId:null} : t));
          this.renderSalidas();
          this._actualizarSelectorEvento();
          this.toast('🗑️ Salida eliminada');
        });
      });
    });
  },

  abrirModalEvento() {
    document.getElementById('ev-nombre').value='';
    document.getElementById('ev-limite').value='';
    document.getElementById('ev-emoji').value='';
    document.getElementById('ev-fecha').value=Fmt.hoyISO();
    this._abrirModal('modal-evento');
    setTimeout(()=>document.getElementById('ev-nombre').focus(),350);
  },

  guardarEvento() {
    const nombre = Seguridad.limpiar(document.getElementById('ev-nombre').value);
    const limite = Seguridad.limpiarNumero(document.getElementById('ev-limite').value);
    const emoji  = Seguridad.limpiarEmoji(document.getElementById('ev-emoji').value || '') || '🎉';
    const fecha  = Seguridad.limpiarFecha(document.getElementById('ev-fecha').value) || Fmt.hoyISO();

    if(!nombre) { this.toast('⚠️ Escribe un nombre para la salida'); return; }
    if(!limite) { this.toast('⚠️ Ingresa el límite que quieres gastar'); return; }

    const eventos = Store.getEventos();
    eventos.push({
      id:'ev_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
      nombre, limite, emoji, fecha, activo:true
    });
    Store.setEventos(eventos);

    this.cerrarModal('modal-evento');
    this.renderSalidas();
    this._actualizarSelectorEvento();
    this.toast(`✓ "${nombre}" — límite de ${Fmt.monto(limite)}`);
  },

  // Genera un PDF con el detalle de gastos de una salida (límite, gastado,
  // restante/excedido, y el listado completo de movimientos de ese evento).
  descargarPdfSalida(id) {
    const ev = Store.getEventos().find(e => e.id === id);
    if (!ev) return;
    if (typeof window.jspdf === 'undefined') {
      this.toast('⚠️ No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const gastado = Store.gastadoEvento(ev.id);
    const restante = ev.limite - gastado;
    const excedido = restante < 0;
    const trans = Store.getTrans()
      .filter(t => t.tipo==='gasto' && t.eventoId===ev.id)
      .sort((a,b) => a.fecha.localeCompare(b.fecha));

    doc.setFontSize(18);
    doc.text(Seguridad.limpiar(ev.nombre) || 'Salida', 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Fecha: ${ev.fecha ? Fmt.fechaCorta(ev.fecha) : '-'}${ev.activo ? '' : '  ·  Finalizada'}`, 14, 28);

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(`Límite:   ${Fmt.monto(ev.limite)}`, 14, 40);
    doc.text(`Gastado:  ${Fmt.monto(gastado)}`, 14, 47);
    doc.setTextColor(excedido ? 200 : 30, excedido ? 30 : 30, 30);
    doc.text(excedido ? `Excedido: ${Fmt.monto(Math.abs(restante))}` : `Restante: ${Fmt.monto(restante)}`, 14, 54);

    let y = 68;
    doc.setTextColor(30);
    doc.setFontSize(13);
    doc.text('Detalle de gastos', 14, y);
    doc.setDrawColor(220);
    doc.line(14, y+3, 196, y+3);
    y += 12;

    doc.setFontSize(10);
    if (!trans.length) {
      doc.setTextColor(130);
      doc.text('Todavía no hay gastos registrados en esta salida.', 14, y);
    } else {
      trans.forEach(t => {
        if (y > 280) { doc.addPage(); y = 20; }
        const cat = getCat(t.categoria);
        doc.setTextColor(30);
        doc.text(`${Fmt.fechaCorta(t.fecha)}`, 14, y);
        doc.text(`${cat.nombre} — ${Seguridad.limpiar(t.descripcion)}`, 42, y);
        doc.text(Fmt.monto(t.monto), 196, y, { align: 'right' });
        y += 7;
      });
      doc.setDrawColor(220);
      doc.line(14, y+1, 196, y+1);
      y += 9;
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text('Total gastado', 42, y);
      doc.text(Fmt.monto(gastado), 196, y, { align: 'right' });
    }

    const nombreArchivo = 'salida-' + (Seguridad.limpiar(ev.nombre) || 'evento')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    doc.save(`${nombreArchivo || 'salida'}.pdf`);
    this.toast('📄 PDF descargado');
  },

  _actualizarSelectorEvento() {
    const campo=document.getElementById('campo-evento');
    const sel=document.getElementById('t-evento');
    if(!campo||!sel) return;
    const hoy=Fmt.hoyISO();
    // Solo se ofrecen salidas activas de hoy en adelante — las de días
    // pasados se quedan como historial en la pantalla de Salidas, pero ya
    // no tiene sentido seguir agregándoles gastos nuevos.
    const eventos=Store.getEventos().filter(e=>e.activo && (!e.fecha || e.fecha>=hoy));
    if(!eventos.length||tipoModal!=='gasto'){campo.style.display='none';return;}
    campo.style.display='block';
    sel.innerHTML=`<option value="">Ninguna</option>`+eventos.map(e=>`<option value="${e.id}">${e.emoji||'🎉'} ${Seguridad.limpiar(e.nombre)}</option>`).join('');
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
      Store.addTrans({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),tipo:'gasto',descripcion:`Abono a meta: ${Seguridad.limpiar(meta?.nombre||'')}`,monto,categoria:'metas_gasto',fecha:Fmt.hoyISO(),nota:'Descontado del saldo'});
      this.toast(`✓ Abonado ${Fmt.monto(monto)} y descontado del saldo`);
    } else {
      this.toast(`✓ Abonado ${Fmt.monto(monto)} a la meta`);
    }
    this.cerrarModal('modal-abonar');
    this.renderMetas();
    if(descontar) App.renderActual();
  },

  eliminarMeta(id) {
    this.confirmar('¿Eliminar esta meta?', () => {
      Store.setMetas(Store.getMetas().filter(m=>m.id!==id));
      this.renderMetas();
      this.toast('Meta eliminada');
    });
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
    this._actualizarAvatarUI(cfg);
    const elNP=document.getElementById('perfil-nombre-txt');
    if(elNP) elNP.textContent=cfg.nombre||'Mi Cuenta';
    this.toast('✓ Perfil guardado');
  },

  // Activar/desactivar notificaciones del sistema para el límite mensual
  toggleNotifLimite() {
    const chk = document.getElementById('cfg-notif-limite');
    if(!chk) return;
    if(!chk.checked) {
      const cfg=Store.getConfig(); cfg.notifLimite=false; Store.setConfig(cfg);
      return;
    }
    if(!('Notification' in window)) {
      this.toast('❌ Tu navegador no soporta notificaciones');
      chk.checked=false;
      return;
    }
    if(Notification.permission==='granted') {
      const cfg=Store.getConfig(); cfg.notifLimite=true; Store.setConfig(cfg);
      this.toast('🔔 Notificaciones activadas');
      this._actualizarTextoNotif();
      return;
    }
    if(Notification.permission==='denied') {
      chk.checked=false;
      this.toast('🚫 Tienes las notificaciones bloqueadas en el navegador');
      this._actualizarTextoNotif();
      return;
    }
    Notification.requestPermission().then(permiso => {
      const cfg=Store.getConfig();
      if(permiso==='granted') {
        cfg.notifLimite=true; Store.setConfig(cfg);
        this.toast('🔔 Notificaciones activadas');
        new Notification('✓ Mis Finanzas', {body:'Te avisaremos aquí cuando estés cerca de tu límite mensual.'});
      } else {
        cfg.notifLimite=false; Store.setConfig(cfg);
        chk.checked=false;
        this.toast('No se activaron las notificaciones');
      }
      this._actualizarTextoNotif();
    });
  },

  confirmarBorrarDatos() {
    this.confirmar('⚠️ ¿Borrar TODOS los datos? Esta acción no se puede deshacer.', () => {
      this.confirmar('¿Seguro? Se borran transacciones, metas e historial.', () => {
        Store.borrarTodo();
        App.renderActual();
        this.toast('Datos borrados');
      });
    });
  },

  // ── Copia de seguridad ────────────────────────
  descargarBackup() {
    const backup = Store.exportarTodo();
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const fecha = Fmt.hoyISO();
    const a = document.createElement('a');
    a.href = url;
    a.download = `mis-finanzas-backup-${fecha}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 3000);
    this.toast('📥 Copia de seguridad descargada');
  },

  restaurarBackup(file) {
    if(!file) return;
    this.confirmar('⚠️ Esto reemplazará todos tus datos actuales con los del archivo. ¿Continuar?', () => {
      const lector = new FileReader();
      lector.onload = () => {
        try {
          const backup = JSON.parse(lector.result);
          if(!Store.importarTodo(backup)) {
            this.toast('❌ El archivo no es una copia de seguridad válida');
            return;
          }
          this.toast('✓ Datos restaurados');
          const cfg = Store.getConfig();
          App.aplicarTema(cfg);
          App.renderActual();
        } catch {
          this.toast('❌ No se pudo leer el archivo');
        }
      };
      lector.readAsText(file);
    }, 'Continuar');
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
    Store.sincronizarFijosPresupuesto(); // por si hubo cambios desde otra pantalla
    const guardado = Store.getPresupuesto();

    // Nombre
    const elNombre = document.getElementById('presup-nombre');
    if (elNombre) { elNombre.value = guardado.nombre || ''; elNombre.oninput = () => this._presupuestoGuardar(); }

    // Ingreso base: usar salario si hay, si no el guardado
    const salario = cfg.sueldo || 0;
    const ingresoBase = guardado.ingreso || salario;
    const elIngreso = document.getElementById('presup-ingreso');
    if (elIngreso) { elIngreso.value = ingresoBase || ''; elIngreso.oninput = () => this.presupuestoRecalcular(); }

    // Cargar items guardados — "fijos" ya viene sincronizado con servicios/cuotas
    this._presupuestoItems.fijos = (guardado.fijos || []).map(f=>({...f}));

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
    this.confirmar('¿Limpiar "Otros gastos" y "Lo que quiero adquirir"?\n\nLos gastos fijos del mes se mantienen.', () => {
      this._presupuestoItems.variables = [];
      this._presupuestoItems.extras = [];
      this._presupuestoRenderListas();
      this.presupuestoRecalcular();
      this.toast('🗑️ Secciones limpiadas');
    });
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
  },

  // Modal de confirmación reutilizable — reemplaza confirm() nativo del
  // navegador (que en algunos móviles puede dejar "atascado" el siguiente
  // toque en la pantalla). Uso: this.confirmar('¿Texto?', () => { ...accion... });
  // onCancelar es opcional: se ejecuta si el usuario cancela en vez de confirmar.
  _confirmCallback: null,
  _cancelCallback: null,
  confirmar(texto, onConfirmar, tituloBoton, onCancelar) {
    const elTexto = document.getElementById('confirmar-texto');
    if (elTexto) elTexto.textContent = texto;
    const btn = document.getElementById('btn-confirmar-aceptar');
    if (btn) btn.textContent = tituloBoton || 'Eliminar';
    this._confirmCallback = onConfirmar;
    this._cancelCallback = onCancelar || null;
    this._abrirModal('modal-confirmar');
  },
  _ejecutarConfirmacion() {
    const cb = this._confirmCallback;
    this.cerrarModal('modal-confirmar');
    this._confirmCallback = null;
    this._cancelCallback = null;
    if (cb) cb();
  },
  _cancelarConfirmacion() {
    const cbCancel = this._cancelCallback;
    this.cerrarModal('modal-confirmar');
    this._confirmCallback = null;
    this._cancelCallback = null;
    if (cbCancel) cbCancel();
  },

  // ── Tutorial interactivo (spotlight) ───────────
  // Cada paso navega a la pantalla real y resalta el elemento real de la
  // interfaz con una explicación al lado — no son tarjetas de texto sueltas.
  _tutorialPasos: [
    { pantalla:'inicio', selector:'#card-saldo-el', titulo:'Tu saldo', texto:'Aquí ves tu saldo disponible del mes, y una gráfica de cómo se ha ido moviendo.' },
    { pantalla:'inicio', selector:'#alertas-pendientes', titulo:'Pendientes de pago', texto:'Cuando tengas servicios, cuotas o tarjetas por pagar, van a aparecer aquí para que no se te olviden.' },
    { pantalla:'inicio', selector:'#btn-fab', titulo:'Agregar un movimiento', texto:'Toca este botón "+" cada vez que quieras registrar un gasto o un ingreso nuevo.' },
    { pantalla:'transacciones', selector:'#btn-abrir-filtros', titulo:'Transacciones', texto:'Aquí ves todo tu historial. Con este botón puedes filtrar por tipo, categoría o buscar algo específico.' },
    { pantalla:'tarjetas', selector:'#pantalla-tarjetas .btn-accion-top', titulo:'Tus tarjetas', texto:'Agrega tus tarjetas de crédito con su día de corte — la app calcula sola cuánto debes pagar cada mes y te avisa a tiempo.' },
    { pantalla:'inicio', selector:'#btn-mas-menu', titulo:'Más opciones', texto:'Aquí encuentras Metas, Cuotas, Salidas, Presupuesto e Historial — el resto de funciones de la app.' },
    { pantalla:'inicio', selector:'.nav-btn[data-pantalla="inicio"]', titulo:'¡Listo!', texto:'Eso es todo por ahora. Puedes repetir este recorrido cuando quieras desde Perfil → Ayuda → "Ver tutorial de la app". ¡Mucho éxito controlando tus finanzas!' }
  ],
  _tutorialIndex: 0,
  _tutorialResizeBind: null,

  abrirTutorial() {
    this._tutorialIndex = 0;
    this._irATutorialPaso(0, 1);
    if (!this._tutorialResizeBind) {
      this._tutorialResizeBind = () => {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay && overlay.style.display === 'block') {
          const paso = this._tutorialPasos[this._tutorialIndex];
          const el = paso && document.querySelector(paso.selector);
          if (el) this._posicionarTutorial(el, paso);
        }
      };
      window.addEventListener('resize', this._tutorialResizeBind);
    }
  },

  _irATutorialPaso(i, direccion) {
    if (i < 0) return;
    if (i >= this._tutorialPasos.length) { this.finalizarTutorial(); return; }
    const dir = direccion || (i >= this._tutorialIndex ? 1 : -1);
    this._tutorialIndex = i;
    const paso = this._tutorialPasos[i];

    // Cerrar cualquier modal abierto que pudiera taparlo
    document.querySelectorAll('.modal-overlay.visible').forEach(m=>m.classList.remove('visible'));

    const mostrar = () => {
      const el = document.querySelector(paso.selector);
      // Si el elemento no existe o está oculto en este momento (ej. no hay
      // pendientes), se salta ese paso automáticamente en vez de trabarse,
      // respetando la dirección en la que se estaba navegando.
      if (!el || el.offsetParent === null) {
        this._irATutorialPaso(i + dir, dir);
        return;
      }
      el.scrollIntoView({block:'center'});
      requestAnimationFrame(() => this._posicionarTutorial(el, paso));
    };

    if (paso.pantalla && paso.pantalla !== App.pantalla) {
      App.irA(paso.pantalla);
      setTimeout(mostrar, 220);
    } else {
      setTimeout(mostrar, 30);
    }
  },

  _posicionarTutorial(el, paso) {
    const overlay = document.getElementById('tutorial-overlay');
    const spot = document.getElementById('tutorial-spotlight');
    const tip = document.getElementById('tutorial-tooltip');
    if (!overlay || !spot || !tip) return;
    overlay.style.display = 'block';

    const r = el.getBoundingClientRect();
    const pad = 8;
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad*2) + 'px';
    spot.style.height = (r.height + pad*2) + 'px';

    document.getElementById('tutorial-tt-titulo').textContent = paso.titulo;
    document.getElementById('tutorial-tt-texto').textContent = paso.texto;

    const dots = document.getElementById('tutorial-tt-dots');
    if (dots) {
      dots.innerHTML = this._tutorialPasos.map((_,idx)=>
        `<span class="${idx===this._tutorialIndex?'activo':''}"></span>`
      ).join('');
    }

    const btnAtras = document.getElementById('tutorial-tt-atras');
    if (btnAtras) btnAtras.style.display = this._tutorialIndex>0 ? 'block' : 'none';
    const btnSig = document.getElementById('tutorial-tt-siguiente');
    if (btnSig) btnSig.textContent = (this._tutorialIndex === this._tutorialPasos.length-1) ? 'Terminar' : 'Siguiente';

    // Posicionar el globo de texto cerca del elemento, sin salirse de pantalla
    tip.style.visibility = 'hidden';
    const tipRect = tip.getBoundingClientRect();
    let top = r.bottom + pad + 12;
    if (top + tipRect.height > window.innerHeight - 10) {
      top = r.top - pad - 12 - tipRect.height;
    }
    if (top < 10) top = 10;
    let left = r.left + r.width/2 - tipRect.width/2;
    left = Math.max(10, Math.min(left, window.innerWidth - tipRect.width - 10));
    tip.style.top = top + 'px';
    tip.style.left = left + 'px';
    tip.style.visibility = 'visible';
  },

  tutorialSiguiente() { this._irATutorialPaso(this._tutorialIndex + 1, 1); },
  tutorialAnterior()  { this._irATutorialPaso(this._tutorialIndex - 1, -1); },
  saltarTutorial()    { this.finalizarTutorial(); },

  finalizarTutorial() {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay) overlay.style.display = 'none';
    const cfg = Store.getConfig();
    if (!cfg.tutorialVisto) {
      cfg.tutorialVisto = true;
      Store.setConfig(cfg);
    }
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
      case 'cuotas':        UI.renderCuotas(); break;
      case 'salidas':       UI.renderSalidas(); break;
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

    // Toggle "ya pagué algunas cuotas" en modal de cuotas
    document.getElementById('cu-ya-pagado')?.addEventListener('change',e=>{
      const row=document.getElementById('cu-pagadas-row');
      if(row) row.style.display=e.target.checked?'flex':'none';
    });

    // Aviso de "día de corte" al elegir tarjeta en el formulario de gasto
    document.getElementById('t-tarjeta')?.addEventListener('change',()=>UI._actualizarAdvertenciaCorte());

    // Guardar transacción
    document.getElementById('btn-guardar-trans')?.addEventListener('click',()=>UI.guardarTransaccion());
    document.getElementById('btn-guardar-tarjeta')?.addEventListener('click',()=>UI.guardarTarjeta());

    // Eliminar tarjeta: manejado con onclick directo en el HTML
    document.getElementById('btn-guardar-limite')?.addEventListener('click',()=>UI.guardarLimite());
    document.getElementById('btn-guardar-meta')?.addEventListener('click',()=>UI.guardarMeta());
    document.getElementById('btn-guardar-cuota')?.addEventListener('click',()=>UI.guardarCuota());
    document.getElementById('btn-guardar-evento')?.addEventListener('click',()=>UI.guardarEvento());
    document.getElementById('btn-confirmar-abono')?.addEventListener('click',()=>UI.confirmarAbono());
    document.getElementById('btn-confirmar-editar-salario')?.addEventListener('click',()=>UI.guardarEdicionSalario());

    // Acciones de pago de tarjeta
    document.getElementById('btn-tc-pagar-completo')?.addEventListener('click',()=>UI.pagarTarjetaCompleto());
    document.getElementById('btn-tc-abonar')?.addEventListener('click',()=>UI.abrirModalAbonarTarjeta());
    document.getElementById('btn-tc-historial')?.addEventListener('click',()=>UI.verHistorialTarjeta());
    document.getElementById('btn-confirmar-tc-abono')?.addEventListener('click',()=>UI.confirmarAbonoTarjeta());
    document.getElementById('tc-abono-monto')?.addEventListener('keydown',e=>{ if(e.key==='Enter') UI.confirmarAbonoTarjeta(); });

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

    // Filtros avanzados de movimientos
    document.getElementById('btn-abrir-filtros')?.addEventListener('click',()=>UI.abrirModalFiltros());
    document.getElementById('btn-limpiar-filtros-inline')?.addEventListener('click',()=>UI.limpiarFiltrosMov());
    document.getElementById('btn-limpiar-filtros')?.addEventListener('click',()=>UI.limpiarFiltrosMov());
    document.getElementById('btn-aplicar-filtros')?.addEventListener('click',()=>UI.aplicarFiltrosMov());
    document.getElementById('filtro-metodo-select')?.addEventListener('change',()=>UI._toggleFiltroTarjetaRow());

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
    document.getElementById('cfg-notif-limite')?.addEventListener('change',()=>UI.toggleNotifLimite());

    // Copia de seguridad — restaurar
    document.getElementById('input-restaurar-backup')?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      UI.restaurarBackup(file);
      e.target.value = ''; // permitir elegir el mismo archivo otra vez
    });

    // SW — se registra con un query de versión para evitar que el navegador
    // sirva una copia vieja de sw.js desde su caché HTTP, y se recarga la
    // página automáticamente en cuanto la versión nueva toma el control.
    if('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js?v=26', {updateViaCache:'none'})
        .then(reg => reg.update())
        .catch(()=>{});
      let swRefrescando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if(swRefrescando) return;
        swRefrescando = true;
        window.location.reload();
      });
    }

    this.irA('inicio');

    // Tutorial de bienvenida — solo la primera vez que se abre la app
    if (!cfg.tutorialVisto) {
      setTimeout(()=>UI.abrirTutorial(), 500);
    }
  }
};

document.addEventListener('DOMContentLoaded',()=>App.init());
