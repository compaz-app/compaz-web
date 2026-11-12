'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Boton from '@/components/ui/base/Boton'
import InfoBoton from '@/components/ui/InfoBoton'
import { TituloBloque } from '@/components/panel/ui'
import AccionCuenta from '@/components/panel/AccionCuenta'
import DialogoPanel from '@/components/panel/DialogoPanel'
import FormCompita from '@/components/panel/FormCompita'
import { cmcPermiteActivar } from '@/lib/cmc-estado'
import type { FichaPersona } from '@/lib/panel-personas-tipos'

// Acciones sobre la cuenta, en la ficha. Cada ruta de /api/admin vuelve a comprobar el permiso en el servidor; aquí solo se muestra lo que esta
// persona puede hacer. Nada borra datos: bloquear y desactivar se pueden revertir.
export default function CuentaPersona({ ficha, puedeCuentas, puedeAtender, puedeEliminar }: { ficha: FichaPersona; puedeCuentas: boolean; puedeAtender: boolean; puedeEliminar: boolean }) {
  const c = ficha.cuenta
  if (!c) return null
  const nombre = ficha.nombre || 'esta persona'
  const hayAsignar = ficha.tipo === 'cliente' && puedeAtender && (ficha.asignables?.length ?? 0) > 0
  if (!puedeCuentas && !hayAsignar && !puedeEliminar) return null
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-1"><TituloBloque>Cuenta</TituloBloque><InfoBoton que="Qué es Cuenta" texto="Acciones sobre la cuenta de esta persona. Cada una pide confirmar y queda anotada con quién la hizo. Bloquear y desactivar no borran nada y se pueden revertir." /></div>
      <div className="flex flex-wrap gap-2">
        {puedeCuentas && ficha.tipo === 'cliente' && (
          <>
            <AccionCuenta peligro={!c.bloqueado} texto={c.bloqueado ? 'Desbloquear' : 'Bloquear'} url="/api/admin/bloquear-cliente" cuerpo={{ usuario_id: ficha.id, bloquear: !c.bloqueado }}
              titulo={c.bloqueado ? `Desbloquear a ${nombre}` : `Bloquear a ${nombre}`}
              mensaje={c.bloqueado ? 'Podrá volver a entrar a su portal y a pedir visitas.' : 'Se le cierra el acceso a su portal y no puede pedir visitas ni escribir. No se borra nada y se puede desbloquear.'}
              info={c.bloqueado ? 'Le devuelve el acceso a su cuenta.' : 'Le cierra el acceso a su cuenta. No borra nada y se puede revertir.'} />
            <AccionCuenta texto={c.portalNuevo === true ? 'Quitar portal nuevo' : 'Activar portal nuevo'} url="/api/admin/portal-nuevo" metodo="PATCH" cuerpo={{ usuario_id: ficha.id, activo: c.portalNuevo === true ? null : true }}
              titulo={`Portal nuevo para ${nombre}`}
              mensaje={c.portalNuevo === true ? 'Vuelve a depender del interruptor general de Ajustes.' : 'Verá el portal nuevo aunque el interruptor general siga apagado. Úsalo con familias de confianza, de una en una.'}
              info="Activa o quita el portal nuevo solo para esta familia, sin tocar al resto." />
          </>
        )}
        {puedeCuentas && ficha.tipo === 'compita' && (
          <>
            <AccionCuenta peligro={!c.bloqueado} texto={c.bloqueado ? 'Desbloquear' : 'Bloquear'} url="/api/admin/bloquear-compita" cuerpo={{ compita_id: ficha.id, bloquear: !c.bloqueado }}
              titulo={c.bloqueado ? `Desbloquear a ${nombre}` : `Bloquear a ${nombre}`}
              mensaje={c.bloqueado ? 'Vuelve a estar disponible. Habrá que verificarlo y reasignarle familias.' : 'Sale del listado, pierde su vínculo de Telegram y se le quitan las familias asignadas. No se borra nada y se puede desbloquear.'}
              info={c.bloqueado ? 'Lo saca del bloqueo. Hay que volver a verificarlo.' : 'Lo saca del listado y le quita sus familias. No borra nada y se puede revertir.'} />
            {ficha.perfil && <EditarPerfil id={ficha.id} nombre={nombre} perfil={ficha.perfil} />}
            {!c.bloqueado && (
              <>
                {(c.verificado || cmcPermiteActivar(ficha.cmc)) && <AccionCuenta texto={c.verificado ? 'Quitar verificación' : 'Verificar'} url="/api/admin/toggle-verificado" cuerpo={{ compita_id: ficha.id, verificado: !c.verificado }}
                  titulo={c.verificado ? `Quitar la verificación de ${nombre}` : `Verificar a ${nombre}`}
                  mensaje={c.verificado ? 'Deja de aparecer como verificado y no recibirá solicitudes nuevas.' : 'Aparecerá como verificado y podrá recibir solicitudes. Hazlo solo tras revisar su entrevista y antecedentes.'}
                  info="Marca si el compita pasó la verificación. Solo un compita verificado y activo recibe solicitudes." />}
                {(c.activo || cmcPermiteActivar(ficha.cmc)) && <AccionCuenta texto={c.activo ? 'Desactivar' : 'Activar'} url="/api/admin/toggle-estado" cuerpo={{ compita_id: ficha.id, estado: c.activo ? 'inactivo' : 'activo' }}
                  titulo={c.activo ? `Desactivar a ${nombre}` : `Activar a ${nombre}`}
                  mensaje={c.activo ? 'Deja de recibir solicitudes nuevas. Lo que ya tiene en curso sigue.' : 'Vuelve a recibir solicitudes nuevas.'}
                  info="Pausa o reanuda la llegada de solicitudes nuevas a este compita." />}
              </>
            )}
          </>
        )}
        {puedeEliminar && (
          <AccionCuenta peligro escribir="ELIMINAR" texto="Eliminar cuenta" url={ficha.tipo === 'cliente' ? '/api/admin/eliminar-cliente' : '/api/admin/eliminar-compita'} metodo="DELETE"
            cuerpo={ficha.tipo === 'cliente' ? { usuario_id: ficha.id } : { compita_id: ficha.id }}
            titulo={`Eliminar la cuenta de ${nombre}`}
            mensaje={ficha.tipo === 'cliente'
              ? 'Se cierra su acceso para siempre y se cancelan sin costo sus visitas abiertas. Todo su historial (visitas, solicitudes, pagos, ficha y mensajes) se conserva y su nombre queda con la marca "(cuenta eliminada)". No se puede deshacer.'
              : 'Deja de existir para el sistema: sin acceso, sin Telegram y sin familias asignadas. Sus visitas y reportes pasados se conservan y su nombre queda con la marca "(cuenta eliminada)". No se puede hacer si tiene visitas abiertas. No se puede deshacer.'}
            opcion={{ clave: 'borrar_datos', texto: ficha.tipo === 'cliente'
              ? 'La persona pidió que se borren sus datos. Se anonimiza: se borran su nombre, correo, teléfono, ficha del familiar, dirección, fotos y mensajes. Quedan solo los pagos y las visitas, sin datos que la identifiquen.'
              : 'La persona pidió que se borren sus datos. Se anonimiza: se borran también su nombre, perfil, foto y contacto.' }}
            info="Cierra la cuenta para siempre. Conserva la información salvo que marques que la persona pidió borrar sus datos. Solo la hace el administrador y pide escribir ELIMINAR." />
        )}
        {hayAsignar && <AsignarCompita clienteId={ficha.id} actual={ficha.compitaId ?? null} opciones={ficha.asignables ?? []} />}
      </div>
    </section>
  )
}

function AsignarCompita({ clienteId, actual, opciones }: { clienteId: string; actual: string | null; opciones: { id: string; nombre: string }[] }) {
  const router = useRouter()
  const [elegido, setElegido] = useState(actual ?? '')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  async function guardar() {
    setCargando(true); setError('')
    try {
      const r = await fetch('/api/admin/asignar-compita', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario_id: clienteId, compita_id: elegido || null }) })
      const j = await r.json().catch(() => null) as { ok?: boolean; error?: string } | null
      if (!r.ok || j?.ok === false) { setError(j?.error ?? `Error ${r.status}`); return }
      router.refresh()
    } catch { setError('Sin conexión. No se cambió nada.') } finally { setCargando(false) }
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <select aria-label="Compita asignado" value={elegido} onChange={(e) => setElegido(e.target.value)} disabled={cargando} className="min-h-9 min-w-40 flex-1 rounded-lg border border-borde bg-blanco px-2 text-sm">
        <option value="">Sin compita</option>
        {opciones.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
      </select>
      <Boton tamano="compacto" variante="secundario" cargando={cargando} disabled={elegido === (actual ?? '')} info="Asigna este compita a la familia (o se lo quita si eliges 'Sin compita'). Cambia a quién escribe la familia, así que úsalo con cuidado." onClick={guardar}>Asignar</Boton>
      {error && <p role="alert" className="w-full text-xs font-bold text-rojo-oscuro">{error}</p>}
    </div>
  )
}

function EditarPerfil({ id, nombre, perfil }: { id: string; nombre: string; perfil: NonNullable<FichaPersona['perfil']> }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <Boton tamano="compacto" variante="secundario" info="Corrige el perfil público del compita: zona, descripción, servicios, video y foto." onClick={() => setAbierto(true)}>Editar perfil</Boton>
      {abierto && (
        <DialogoPanel titulo={`Perfil de ${nombre}`} onCerrar={() => setAbierto(false)}>
          <div className="mt-3"><FormCompita modo="editar" id={id} inicial={perfil} onListo={() => setAbierto(false)} /></div>
        </DialogoPanel>
      )}
    </>
  )
}
