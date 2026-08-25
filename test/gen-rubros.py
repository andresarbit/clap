# -*- coding: utf-8 -*-
"""Genera el catalogo completo de subrubros internos de una productora.
Se usa para cargar lineas de presupuesto y, sobre todo, para clasificar cada
factura que entra. La idea es que nadie tenga que escribir el concepto a mano.
"""
import io, json

SUB = {
 '01': ['Scouting / búsqueda de locaciones','Casting','Pre Production Meeting (PPM)',
        'Permisos y trámites','Movilidad de preproducción','Oficina y coworking',
        'Comunicaciones y telefonía','Papelería e impresiones','Research y referencias',
        'Storyboard','Traducciones','Honorarios de desarrollo','Mensajería'],
 '02': ['Director','Ayudante de Dirección (1° AD)','2° Ayudante de Dirección',
        '3° Ayudante de Dirección','Script / Continuista','Storyboard artist',
        'Director de segunda unidad','Coach de actores','Asistente de dirección de casting'],
 '03': ['Productor Ejecutivo','Productor','Jefe de Producción','Coordinador de Producción',
        'Asistente de Producción','2° Asistente de Producción','Runner / Cadete',
        'Location Manager','Fijador','Director de Casting','Productor de campo',
        'Contador de producción','Caja chica de producción','Producer de agencia'],
 '04': ['Director de Fotografía','Operador de Cámara','Foquista (1° AC)','2° Asistente de Cámara',
        'DIT','Data manager','Video Assist','Operador de Steadicam','Operador de Ronin / gimbal',
        'Piloto de Drone','Fotógrafo de fija','Cámara de backstage','Segunda unidad de cámara'],
 '05': ['Gaffer','Best Boy eléctrico','Eléctrico','Jefe eléctrico','Key Grip','Grip',
        'Best Boy grip','Maquinista','Generadorista','Rigger','Operador de dolly',
        'Operador de grúa','Expendables de eléctrica'],
 '06': ['Director de Arte','Ambientador / 1° Asistente de Arte','Asistente de Arte',
        'Ayudante de Arte','Utilero','Escenógrafo','Constructor','Carpintero','Pintor',
        'Herrero','Compras de arte','Alquiler de utilería','Alquiler de muebles',
        'Construcción de set','Plantas y flores','Food styling','Animales y adiestrador',
        'Armería / utilería especial','Gráfica y cartelería','Devoluciones y restitución'],
 '07': ['Vestuarista','Asistente de Vestuario','Ayudante de Vestuario','Compra de vestuario',
        'Alquiler de vestuario','Lavandería y tintorería','Arreglos y costura',
        'Maquillador/a','Peinador/a','Asistente de Maquillaje y Peinado',
        'Caracterización y prótesis','Manicura','Insumos de maquillaje','Barbería'],
 '08': ['Sonidista Directo','Microfonista','Asistente de sonido','Equipo de sonido directo',
        'Playback','Alquiler de microfonía','Insumos de sonido'],
 '09': ['Actor / Actriz Principal','Actor / Actriz Secundario','Bolo','Extra','Figuración especial',
        'Modelo','Voz en off','Doble de riesgo','Coordinador de riesgo','Coach de elenco',
        'Fee de agencia de casting','Buyout / Cesión de derechos','Renovación de derechos',
        'Cargas sociales de elenco','Tutor de menores'],
 '10': ['Fee de locación','Permiso municipal de filmación','Permiso de organismo / privado',
        'Fijador de locación','Estudio / plató','Servicios de locación (luz, agua)',
        'Limpieza','Restitución y daños','Seguridad de locación','Estacionamiento',
        'Baños químicos','Vigilancia nocturna','Seguro de locación'],
 '11': ['Paquete cámara + ópticas','Ópticas especiales','Paquete de luces','Paquete de grip',
        'Grúa / pluma','Dolly y rieles','Grupo electrógeno','Camión de luces','Camión de grip',
        'Monitores','Handies / walkies','Carpa y estructura','Medios de grabación (tarjetas)',
        'Discos y backup','Expendables (gelatinas, cintas, pilas)','Alquiler de generador',
        'Equipos de climatización','Alquiler de drone'],
 '12': ['Combi de pasajeros','Minibús','Camión de producción','Auto de producción','Moto',
        'Chofer','Combustible','Peajes','Estacionamiento y garage','Pasajes aéreos',
        'Pasajes terrestres','Exceso de equipaje','Hotel','Viáticos / per diem',
        'Traslados aeropuerto','Remises y aplicaciones','Fletes'],
 '13': ['Desayuno','Almuerzo','Merienda / snacks','Cena','Agua y bebidas','Café y termos',
        'Catering de elenco','Dietas especiales','Servicio y mozos','Descartables',
        'Compras de supermercado','Catering de preproducción'],
 '14': ['Postproductor','Montajista','Asistente de edición','Sala de edición','Online / conform',
        'Colorista','Sala de color','VFX / composición','Motion graphics','Diseño sonoro',
        'Mezcla y masterización de audio','Estudio de sonido','Música original',
        'Licencia de música','Derechos de archivo','Locución','Subtitulado','Traducción de guion',
        'Entregables y copias','Backup y archivo','Transcoding'],
 '15': ['Seguro de Accidentes Personales','ART','Responsabilidad Civil','Todo Riesgo Equipos',
        'Seguro de cancelación','Seguro de vehículos','Honorarios contables','Honorarios legales',
        'Escribano','Contratos y cesiones','Registro de obra / marca','Asesoría laboral'],
 '16': ['Enfermero / paramédico','Ambulancia','Servicio de emergencias','Seguridad e higiene',
        'Matafuegos y elementos de seguridad','Elementos de protección personal',
        'Test y controles sanitarios','Coordinador de intimidad','Guardavidas'],
 '17': ['Impuestos y tasas','Ingresos Brutos','Impuesto al cheque','Comisiones bancarias',
        'Retenciones','Percepciones','Diferencia de cambio','Gastos de transferencia',
        'Software y licencias','Internet y telefonía de oficina','Alquiler de oficina',
        'Sueldos de estructura','Contingencia','Fee de producción'],
}

p = 'D:/Cuadro/clap.html'
s = io.open(p, encoding='utf-8').read()

ini = s.index('/* Catálogo de funciones por rubro')
fin = s.index('\n};', ini) + 3

out = []
out.append('/* Catálogo de subrubros internos, por rubro. Es la taxonomía con la que se')
out.append('   carga una línea de presupuesto Y con la que se clasifica cada factura que')
out.append('   entra, así nadie escribe el concepto a mano y todo suma al mismo lugar.  */')
out.append('const FUNCIONES = {')
for cod in sorted(SUB):
    items = SUB[cod]
    linea = "  '%s':[" % cod
    buf = linea
    partes = []
    for it in items:
        partes.append(json.dumps(it, ensure_ascii=False))
    # envolver a ~96 columnas
    cur = buf
    primero = True
    for pz in partes:
        add = pz if primero else ',' + pz
        if len(cur) + len(add) > 96:
            out.append(cur + ',')
            cur = '        ' + pz
        else:
            cur += add
        primero = False
    out.append(cur + '],')
out.append('};')
out.append('')
out.append('/* Todos los subrubros como una lista plana, para buscar al clasificar. */')
out.append('const SUBRUBROS = Object.entries(FUNCIONES).flatMap(([r,xs])=>xs.map(x=>({r, s:x})));')

nuevo = '\n'.join(out)
s = s[:ini] + nuevo + s[fin:]
io.open(p, 'w', encoding='utf-8').write(s)

total = sum(len(v) for v in SUB.values())
print('rubros: %d · subrubros: %d' % (len(SUB), total))
for cod in sorted(SUB):
    print('  %s  %2d  %s' % (cod, len(SUB[cod]), ' · '.join(SUB[cod][:4]) + (' …' if len(SUB[cod]) > 4 else '')))
