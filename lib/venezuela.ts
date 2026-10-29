// ══════════════════════════════════════════════════════════════════════════════
// Compaz — Datos de Venezuela compartidos por los formularios públicos
// ══════════════════════════════════════════════════════════════════════════════

// Estados y municipios — usado para zonas de cobertura de compitas y zona del familiar del cliente.
// Debe coincidir exactamente con los municipios que registran los compitas en `compita.zona`
// (formato "Estado — Municipio"), para que el filtro del mapa de compitas funcione.
export const ZONAS_MUNICIPIOS: Record<string, string[]> = {
  'Amazonas': ['Alto Orinoco', 'Atabapo', 'Atures', 'Autana', 'Manapiare', 'Maroa', 'Río Negro'],
  'Anzoátegui': ['Anaco', 'Aragua', 'Bolívar', 'Bruzual', 'Cajigal', 'Carvajal', 'Freites', 'Guanipa', 'Guanta', 'Independencia', 'Libertad', 'Miranda', 'Monagas', 'Peñalver', 'Píritu', 'San Juan de Capistrano', 'Santa Ana', 'Simón Rodríguez', 'Sir Arthur McGregor', 'Sotillo', 'Turístico Diego Bautista Urbaneja'],
  'Apure': ['Achaguas', 'Biruaca', 'Muñoz', 'Páez', 'Pedro Camejo', 'Rómulo Gallegos', 'San Fernando'],
  'Aragua': ['Alcántara', 'Bolívar', 'Camatagua', 'Girardot', 'Iragorry', 'Lamas', 'Libertador', 'Mariño', 'Michelena', 'Ocumare de la Costa de Oro', 'Revenga', 'Ribas', 'San Casimiro', 'San Sebastián', 'Sucre', 'Tovar', 'Urdaneta', 'Zamora'],
  'Barinas': ['Alberto Arvelo Torrealba', 'Andrés Eloy Blanco', 'Antonio José de Sucre', 'Arismendi', 'Barinas', 'Bolívar', 'Cruz Paredes', 'Ezequiel Zamora', 'Obispos', 'Pedraza', 'Rojas', 'Sosa'],
  'Bolívar': ['Angostura del Orinoco', 'Caroní', 'Cedeño', 'Chien', 'El Callao', 'Gran Sabana', 'Piar', 'Roscio', 'Sifontes', 'Sucre'],
  'Carabobo': ['Bejuma', 'Carlos Arvelo', 'Diego Ibarra', 'Guacara', 'Juan José Mora', 'Libertador', 'Los Guayos', 'Miranda', 'Montalbán', 'Naguanagua', 'Puerto Cabello', 'San Diego', 'San Joaquín', 'Valencia'],
  'Cojedes': ['Anzoátegui', 'Girardot', 'Lima Blanco', 'Pao de San Juan Bautista', 'Ricaurte', 'Rómulo Gallegos', 'San Carlos', 'Tinaco', 'Tinaquillo'],
  'Delta Amacuro': ['Antonio Díaz', 'Casacoima', 'Pedernales', 'Tucupita'],
  'Distrito Capital': ['Libertador'],
  'Falcón': ['Acosta', 'Bolívar', 'Buchivacoa', 'Carirubana', 'Colina', 'Dabajuro', 'Democracia', 'Falcón', 'Federación', 'Iturriza', 'Jacura', 'Los Taques', 'Manaure', 'Mauroa', 'Miranda', 'Palmasola', 'Petit', 'Píritu', 'San Francisco', 'Silva', 'Sucre', 'Tocópero', 'Unión', 'Urumaco', 'Zamora'],
  'Guárico': ['Camaguán', 'Chaguaramas', 'El Socorro', 'Francisco de Miranda', 'José Félix Ribas', 'José Tadeo Monagas', 'Juan Germán Roscio', 'Juan José Rondón', 'Julián Mellado', 'Leonardo Infante', 'Ortiz', 'San Gerónimo de Guayabal', 'San José de Guaribe', 'Santa María de Ipire', 'Zaraza'],
  'Lara': ['Andrés Eloy Blanco', 'Crespo', 'Iribarren', 'Jiménez', 'Morán', 'Palavecino', 'Simón Planas', 'Torres', 'Urdaneta'],
  'Mérida': ['Alberto Adriani', 'Andrés Bello', 'Antonio Pinto Salinas', 'Aricagua', 'Arzobispo Chacón', 'Campo Elías', 'Caracciolo Parra Olmedo', 'Cardenal Quintero', 'Guaraque', 'Julio César Salas', 'Justo Briceño', 'Libertador', 'Miranda', 'Obispo Ramos de Lora', 'Padre Noguera', 'Pueblo Llano', 'Rangel', 'Rivas Dávila', 'Santos Marquina', 'Sucre', 'Tovar', 'Tulio Febres Cordero', 'Zea'],
  'Miranda': ['Acevedo', 'Andrés Bello', 'Baruta', 'Bolívar', 'Brión', 'Buroz', 'Carrizal', 'Chacao', 'Cristóbal Rojas', 'El Hatillo', 'Guaicaipuro', 'Gual', 'Independencia', 'Lander', 'Los Salias', 'Páez', 'Paz Castillo', 'Plaza', 'Sucre', 'Urdaneta', 'Zamora'],
  'Monagas': ['Acosta', 'Aguasay', 'Bolívar', 'Caripe', 'Cedeño', 'Libertador', 'Maturín', 'Piar', 'Punceres', 'Santa Bárbara', 'Sotillo', 'Uracoa', 'Zamora'],
  'Nueva Esparta': ['Antolín del Campo', 'Antonio Díaz', 'Arismendi', 'García', 'Gómez', 'Macanao', 'Maneiro', 'Marcano', 'Mariño', 'Tubores', 'Villalba'],
  'Portuguesa': ['Agua Blanca', 'Araure', 'Esteller', 'Guanare', 'Guanarito', 'José Vicente de Unda', 'Ospino', 'Páez', 'Papelón', 'San Genaro de Boconoíto', 'San Rafael de Onoto', 'Santa Rosalía', 'Sucre', 'Turén'],
  'Sucre': ['Andrés Eloy Blanco', 'Andrés Mata', 'Arismendi', 'Benítez', 'Bermúdez', 'Bolívar', 'Cajigal', 'Cruz Salmerón Acosta', 'Libertador', 'Mariño', 'Mejía', 'Montes', 'Ribero', 'Sucre', 'Valdez'],
  'Táchira': ['Andrés Bello', 'Antonio Rómulo Costa', 'Ayacucho', 'Bolívar', 'Cárdenas', 'Córdoba', 'Fernández Feo', 'Francisco de Miranda', 'García de Hevia', 'Guásimos', 'Independencia', 'Jáuregui', 'José María Vargas', 'Junín', 'Libertad', 'Libertador', 'Lobatera', 'Michelena', 'Panamericano', 'Pedro María Ureña', 'Rafael Urdaneta', 'Samuel Darío Maldonado', 'San Cristóbal', 'San Judas Tadeo', 'Seboruco', 'Simón Rodríguez', 'Sucre', 'Torbes', 'Uribante'],
  'Trujillo': ['Andrés Bello', 'Boconó', 'Bolívar', 'Candelaria', 'Carache', 'Carvajal', 'Escuque', 'Juan Vicente Campo Elías', 'La Ceiba', 'Márquez Cañizales', 'Miranda', 'Monte Carmelo', 'Motatán', 'Pampán', 'Pampanito', 'Rangel', 'Sucre', 'Trujillo', 'Urdaneta', 'Valera'],
  'Vargas': ['Vargas'],
  'Yaracuy': ['Arístides Bastidas', 'Bolívar', 'Bruzual', 'Cocorote', 'Independencia', 'José Antonio Páez', 'La Trinidad', 'Manuel Monge', 'Nirgua', 'Peña', 'San Felipe', 'Sucre', 'Urachiche', 'Veroes'],
  'Zulia': ['Almirante Padilla', 'Baralt', 'Cabimas', 'Catatumbo', 'Colón', 'Francisco Javier Pulgar', 'Guajira', 'Jesús Enrique Lossada', 'Jesús María Semprún', 'La Cañada de Urdaneta', 'Lagunillas', 'Machiques de Perijá', 'Mara', 'Maracaibo', 'Miranda', 'Rosario de Perijá', 'San Francisco', 'Santa Rita', 'Simón Bolívar', 'Sucre', 'Valmore Rodríguez'],
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
