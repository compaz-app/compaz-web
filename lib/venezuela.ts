// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Datos de Venezuela compartidos por los formularios públicos
// ══════════════════════════════════════════════════════════════════════════════

// Estados y municipios — usado para zonas de cobertura de compitas y zona del familiar del cliente.
// Debe coincidir exactamente con los municipios que registran los compitas en `compita.zona`
// (formato "Estado — Municipio"), para que el filtro del mapa de compitas funcione.
export const ZONAS_MUNICIPIOS: Record<string, string[]> = {
  'Amazonas': ['Atures', 'Alto Orinoco', 'Autana', 'Manapiare', 'Maroa', 'Negro', 'Río Negro', 'Sipapo'],
  'Anzoátegui': ['Simón Bolívar', 'Sotillo', 'Diego Bautista Urbaneja', 'Bruzual', 'Cajigal', 'Fernando de Peñalver', 'Francisco del Carmen Carvajal', 'Francisco Javier Freites', 'Guanipa', 'Guanta', 'Independencia', 'Juan Antonio Sotillo', 'Juan Manuel Cajigal', 'Libertad', 'McGregor', 'Miranda', 'Monagas', 'Peñalver', 'Píritu', 'Sir Arthur McGregor', 'Simón Rodríguez'],
  'Apure': ['San Fernando', 'Achaguas', 'Biruaca', 'Muñoz', 'Páez', 'Pedro Camejo', 'Rómulo Gallegos'],
  'Aragua': ['Girardot', 'Mario Briceño Iragorry', 'Ocumare de la Costa de Oro', 'Costa de Oro', 'Libertador', 'Sucre', 'Linares Alcántara', 'Francisco Linares Alcántara', 'Bolívar', 'Ribas', 'Santos Michelena', 'Zamora', 'Camatagua', 'San Casimiro', 'San Sebastián', 'Urdaneta'],
  'Barinas': ['Barinas', 'Alberto Arvelo Torrealba', 'Andrés Eloy Blanco', 'Antonio José de Sucre', 'Arismendi', 'Bolívar', 'Cruz Paredes', 'Ezequiel Zamora', 'Obispos', 'Pedraza', 'Rojas', 'Sosa', 'Ticoporo'],
  'Bolívar': ['Caroní', 'Heres', 'Cedeño', 'El Callao', 'Gran Sabana', 'Padre Pedro Chien', 'Piar', 'Raúl Leoni', 'Roscio', 'Sifontes', 'Sucre'],
  'Carabobo': ['Valencia', 'Naguanagua', 'San Diego', 'Libertador', 'Los Guayos', 'Miranda', 'Montalbán', 'Puerto Cabello', 'Juan José Mora', 'Guacara', 'Diego Ibarra', 'Carlos Arvelo', 'Bejuma'],
  'Cojedes': ['Tinaco', 'Anzoátegui', 'Girardot', 'Lima Blanco', 'Pao de San Juan Bautista', 'Ricaurte', 'Rómulo Gallegos', 'San Carlos', 'Tinaquillo'],
  'Delta Amacuro': ['Tucupita', 'Antonio Díaz', 'Casacoima', 'Pedernales'],
  'Distrito Capital': ['Libertador'],
  'Falcón': ['Miranda', 'Acosta', 'Bolívar', 'Buchivacoa', 'Carirubana', 'Colina', 'Dabajuro', 'Democracia', 'Federación', 'Iturriza', 'Jacura', 'Los Taques', 'Mauroa', 'Palmasola', 'Petit', 'Piritu', 'San Francisco', 'Silva', 'Sucre', 'Tocópero', 'Unión', 'Urumaco', 'Zamora'],
  'Guárico': ['Juan Germán Roscio', 'Camaguán', 'Chaguaramas', 'El Socorro', 'Francisco de Miranda', 'José Félix Ribas', 'José Tadeo Monagas', 'Julian Mellado', 'Las Mercedes', 'Leonardo Infante', 'Mellado', 'Ortiz', 'San Gerónimo de Guayabal', 'San José de Guaribe', 'Santa María de Ipire', 'Zaraza'],
  'Lara': ['Iribarren', 'Andrés Eloy Blanco', 'Crespo', 'Jiménez', 'Morán', 'Palavecino', 'Simón Planas', 'Torres', 'Urdaneta'],
  'Mérida': ['Libertador', 'Campo Elías', 'Santos Marquina', 'Sucre', 'Rangel', 'Cardenal Quintero', 'Guaraque', 'Justo Briceño', 'Miranda', 'Obispo Ramos de Lora', 'Padre Noguera', 'Pueblo Llano', 'Rivas Dávila', 'Tovar', 'Tulio Febres Cordero', 'Arzobispo Chacón', 'Antonio Pinto Salinas', 'Aricagua', 'Zea', 'Caracciolo Parra Olmedo'],
  'Miranda': ['Baruta', 'Chacao', 'El Hatillo', 'Sucre', 'Guaicaipuro', 'Carrizal', 'Los Salias', 'Cristóbal Rojas', 'Lander', 'Paz Castillo', 'Urdaneta', 'Acevedo', 'Brión', 'Buroz', 'Páez', 'Pedro Gual', 'Independencia', 'Simón Bolívar', 'Zamora'],
  'Monagas': ['Maturín', 'Acosta', 'Aguasay', 'Bolívar', 'Caripe', 'Cedeño', 'Libertador', 'Piar', 'Punceres', 'Santa Bárbara', 'Sotillo', 'Uracoa', 'Ezequiel Zamora'],
  'Nueva Esparta': ['Mariño', 'Antolín del Campo', 'Arismendi', 'Díaz', 'García', 'Gómez', 'Macanao', 'Maneiro', 'Marcano', 'Tubores', 'Villalba'],
  'Portuguesa': ['Guanare', 'Araure', 'Acarigua', 'Esteller', 'Guanarito', 'José Vicente de Unda', 'Ospino', 'Páez', 'Papelón', 'San Genaro de Boconoíto', 'San Rafael de Onoto', 'Santa Rosalía', 'Sucre', 'Turén'],
  'Sucre': ['Sucre', 'Arismendi', 'Benítez', 'Bermúdez', 'Bolívar', 'Cajigal', 'Cruz Salmerón Acosta', 'Libertador', 'Mariño', 'Mejías', 'Montes', 'Ribero', 'Valdez'],
  'Táchira': ['San Cristóbal', 'Torbes', 'Cárdenas', 'Guásimos', 'Fernández Feo', 'Libertad', 'Lobatera', 'Michelena', 'Panamericano', 'Junín', 'Bolívar', 'Pedro María Ureña', 'García de Hevia', 'Seboruco', 'Ayacucho', 'Córdoba', 'Sucre', 'Uribante', 'Libertador', 'Andrés Bello', 'Antonio Rómulo Costa', 'Francisco de Miranda', 'Jáuregui', 'Montes', 'Samuel Darío Maldonado', 'Simón Rodríguez'],
  'Trujillo': ['Trujillo', 'Andrés Bello', 'Bolívar', 'Boconó', 'Candelaria', 'Carache', 'Escuque', 'José Felipe Márquez Cañizales', 'La Ceiba', 'Miranda', 'Motatán', 'Monte Carmelo', 'Pampán', 'Pampanito', 'Rafael Rangel', 'San Rafael de Carvajal', 'Sucre', 'Urdaneta', 'Valera'],
  'Vargas': ['Vargas'],
  'Yaracuy': ['San Felipe', 'Bolívar', 'Bruzual', 'Cocorote', 'Independencia', 'La Trinidad', 'Manuel Monge', 'Nirgua', 'Páez', 'Peña', 'Sucre', 'Urachiche'],
  'Zulia': ['Maracaibo', 'San Francisco', 'Cabimas', 'Ciudad Ojeda', 'Lagunillas', 'Jesús Enrique Lossada', 'La Cañada de Urdaneta', 'Miranda', 'Mara', 'Páez', 'Rosario de Perijá', 'Machiques de Perijá', 'Colón', 'Catatumbo', 'Jesús María Semprún', 'Sucre', 'Valmore Rodríguez', 'Simón Bolívar', 'Santa Rita', 'Baralt'],
}

// Estados y ciudades principales (uso general — no coincide con los municipios de ZONAS_MUNICIPIOS)
export const VENEZUELA_ESTADOS: Record<string, string[]> = {
  "Amazonas": ["Puerto Ayacucho", "San Fernando de Atabapo", "San Juan de Manapiare"],
  "Anzoátegui": ["Barcelona", "Puerto La Cruz", "El Tigre", "Anaco", "Lechería", "Guanta", "Cantaura", "Clarines"],
  "Apure": ["San Fernando de Apure", "Guasdualito", "Achaguas", "Biruaca"],
  "Aragua": ["Maracay", "La Victoria", "Turmero", "Cagua", "Villa de Cura", "El Limón", "Palo Negro"],
  "Barinas": ["Barinas", "Barinitas", "Socopó", "Ciudad Bolivia", "Santa Bárbara"],
  "Bolívar": ["Ciudad Bolívar", "Ciudad Guayana (Puerto Ordaz)", "San Félix", "Upata", "Caicara del Orinoco"],
  "Carabobo": ["Valencia", "Puerto Cabello", "Guacara", "San Diego", "Los Guayos", "Naguanagua", "Mariara"],
  "Cojedes": ["San Carlos", "Tinaquillo", "El Pao", "Tinaco"],
  "Delta Amacuro": ["Tucupita", "Pedernales"],
  "Dependencias Federales": ["Los Roques", "La Orchila"],
  "Distrito Capital": ["Caracas"],
  "Falcón": ["Coro", "Punto Fijo", "La Vela de Coro", "Chichiriviche", "Tucacas"],
  "Guárico": ["San Juan de los Morros", "Calabozo", "Valle de la Pascua", "Zaraza", "Altagracia de Orituco"],
  "Lara": ["Barquisimeto", "Carora", "El Tocuyo", "Quíbor", "Chivacoa"],
  "Mérida": ["Mérida", "El Vigía", "Ejido", "Tovar", "Valera (sector Mérida)"],
  "Miranda": ["Los Teques", "Guarenas", "Guatire", "Ocumare del Tuy", "Santa Teresa del Tuy", "Charallave", "Petare", "Caucagua"],
  "Monagas": ["Maturín", "Caripito", "Punta de Mata", "Temblador"],
  "Nueva Esparta": ["Porlamar", "La Asunción", "Pampatar", "Juan Griego"],
  "Portuguesa": ["Guanare", "Acarigua", "Araure", "Biscucuy", "Turén"],
  "Sucre": ["Cumaná", "Carúpano", "Güiria", "Cariaco"],
  "Táchira": ["San Cristóbal", "Rubio", "Táriba", "La Fría", "San Antonio del Táchira", "Colón"],
  "Trujillo": ["Trujillo", "Valera", "Boconó", "La Ceiba", "Pampán"],
  "Vargas": ["La Guaira", "Maiquetía", "Catia La Mar", "Naiguatá"],
  "Yaracuy": ["San Felipe", "Yaritagua", "Nirgua", "Chivacoa", "Yumare"],
  "Zulia": ["Maracaibo", "Cabimas", "Ciudad Ojeda", "Machiques", "San Francisco", "Lagunillas", "Baralt"],
};

// Prefijos de operadoras móviles
export const VE_PREFIJOS = [
  { code: "0412", label: "0412" },
  { code: "0414", label: "0414" },
  { code: "0416", label: "0416" },
  { code: "0422", label: "0422" },
  { code: "0424", label: "0424" },
  { code: "0426", label: "0426" },
];
