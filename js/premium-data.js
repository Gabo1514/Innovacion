(function () {
  const img = (id, width = 1400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=82`;
  const images = {
    hero: img('photo-1705034598432-1694e203cdf3', 2400),
    introMain: 'https://buganvillatours.com/wp-content/uploads/2018/04/ruta-del-pisco-ica.jpg',
    introAccent: img('photo-1527628852234-8128619df1b0', 1000),
    dunes: img('photo-1716584155947-8b4330dbc980'),
    paracas: 'https://buganvillatours.com/wp-content/uploads/2018/04/Tour-Islas-Ballestas-Chincha.jpg',
    nasca: img('photo-1625851425826-9082c9bf3958'),
    utv: 'https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina3.jpg',
    utvGroup: 'https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina2.jpg',
    sandboarding: 'https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina.jpg',
    guide: 'https://buganvillatours.com/wp-content/uploads/2025/06/Tour-Paseo-Premium-en-UTV-Huacachina4.jpg'
  };
  const imageMetadata = {
    hero: {
      alt: { es: 'Dunas de Huacachina bajo un cielo de atardecer', en: 'Huacachina sand dunes beneath an evening sky' },
      credit: 'Vlad D / Unsplash',
      source: 'https://unsplash.com/photos/a-desert-landscape-with-mountains-in-the-distance-Ag9cWC8-eY8',
      location: 'Huacachina, Perú'
    },
    introMain: {
      alt: { es: 'Visitantes de Buganvilla Tours frente a la torre de la bodega Tacama en Ica', en: 'Buganvilla Tours visitors in front of the Tacama winery tower in Ica' },
      credit: 'Buganvilla Tours',
      source: 'https://buganvillatours.com/en/project/ica-the-route-of-pisco/',
      location: 'Tacama, Ica, Perú'
    },
    introAccent: {
      alt: { es: 'Viajeros en la cresta de una duna en Huacachina', en: 'Travellers on the ridge of a Huacachina sand dune' },
      credit: 'Willian Justen de Vasconcellos / Unsplash',
      source: 'https://unsplash.com/photos/a-group-of-people-standing-on-top-of-a-sand-dune-PqASFzyUmh0',
      location: 'Huacachina, Perú'
    },
    dunes: {
      alt: { es: 'Atardecer sobre las dunas de Huacachina', en: 'Sunset over the Huacachina sand dunes' },
      credit: 'Mark Kuiper / Unsplash',
      source: 'https://unsplash.com/photos/the-sun-is-setting-over-the-sand-dunes-6XCf0bTH7Qk',
      location: 'Huacachina, Perú'
    },
    paracas: {
      alt: { es: 'Lobo marino sobre las rocas de las Islas Ballestas, en Paracas', en: 'A sea lion on the rocks of the Ballestas Islands in Paracas' },
      credit: 'Buganvilla Tours',
      source: 'https://buganvillatours.com/en/project/chincha-ballestas-islands-tour/',
      location: 'Islas Ballestas, Paracas, Perú'
    },
    nasca: {
      alt: { es: 'Carretera Panamericana atravesando el desierto de Nasca', en: 'The Pan-American Highway crossing the Nasca desert' },
      credit: 'JP Desvigne / Unsplash',
      source: 'https://unsplash.com/photos/brown-and-gray-mountains-under-blue-sky-during-daytime-xFuHECFeBfA',
      location: 'Nasca, Perú'
    },
    utv: {
      alt: { es: 'UTV de Buganvilla Tours recorriendo las dunas de Huacachina', en: 'A Buganvilla Tours UTV driving across the Huacachina dunes' },
      credit: 'Buganvilla Tours',
      source: 'https://buganvillatours.com/utv-en-huacachina/',
      location: 'Huacachina, Ica, Perú'
    },
    utvGroup: {
      alt: { es: 'Grupo de viajeros junto a los UTV, con el oasis de Huacachina al fondo', en: 'Travellers beside the UTVs, with the Huacachina oasis in the background' },
      credit: 'Buganvilla Tours',
      source: 'https://buganvillatours.com/utv-en-huacachina/',
      location: 'Huacachina, Ica, Perú'
    },
    sandboarding: {
      alt: { es: 'Viajero con casco rojo descendiendo en tabla por una duna de Huacachina', en: 'A traveller wearing a red helmet sandboarding down a Huacachina dune' },
      credit: 'Buganvilla Tours',
      source: 'https://buganvillatours.com/utv-en-huacachina/',
      location: 'Huacachina, Ica, Perú'
    },
    guide: {
      alt: { es: 'Guía ayudando a una viajera con casco a prepararse para el sandboarding en Huacachina', en: 'A guide helping a helmeted traveller prepare for sandboarding in Huacachina' },
      credit: 'Buganvilla Tours',
      source: 'https://buganvillatours.com/utv-en-huacachina/',
      location: 'Huacachina, Ica, Perú'
    }
  };

  const tours = [
    {
      id: 'utv-huacachina', destination: 'huacachina',
      title: { es: 'Huacachina · UTV privado', en: 'Huacachina · Private UTV' },
      region: { es: 'Huacachina · Ica', en: 'Huacachina · Ica' },
      description: { es: 'Desde GO Adventure hacia las dunas de Huacachina. Una hora de recorrido, mirador del oasis y sandboarding, con conductor y equipo incluidos.', en: 'From GO Adventure into the Huacachina dunes. A one-hour tour, oasis viewpoint and sandboarding, with a driver and equipment included.' },
      image: images.utv, alt: imageMetadata.utv.alt,
      imageSource: imageMetadata.utv.source,
      duration: { es: '1 hora aprox.', en: 'Approx. 1 hour' }, durationHours: 1,
      pricePEN: 120, childPricePEN: 90,
      mode: { es: 'UTV privado', en: 'Private UTV' },
      category: { es: 'Desierto', en: 'Desert' },
      booking: 'online', paxMin: 2, paxMax: 9,
      includes: { es: ['UTV privado con conductor', 'Casco y lentes de protección', 'Equipo de sandboarding amateur', 'Parada en el mirador del oasis'], en: ['Private UTV with driver', 'Protective helmet and goggles', 'Amateur sandboarding equipment', 'Stop at the oasis viewpoint'] },
      excludes: { es: ['Alimentación y bebidas', 'Traslado al punto de encuentro, salvo complemento contratado', 'Tasas locales que pudieran aplicar, por confirmar'], en: ['Meals and drinks', 'Transport to the meeting point unless selected as an extra', 'Any applicable local fees, to be confirmed'] },
      itinerary: [
        { title: { es: 'Encuentro en Huacachina', en: 'Meet in Huacachina' }, body: { es: 'Presentación en GO Adventure, entrega de casco y lentes e indicaciones del conductor.', en: 'Meet at GO Adventure for your helmet, goggles and driver briefing.' } },
        { title: { es: 'Recorrido entre dunas', en: 'Drive among the dunes' }, body: { es: 'Salida en UTV. Cada unidad lleva hasta tres pasajeros; el grupo se distribuye en los vehículos necesarios.', en: 'Depart by UTV. Each vehicle carries up to three passengers; larger groups use the required number of vehicles.' } },
        { title: { es: 'Mirador y sandboarding', en: 'Viewpoint and sandboarding' }, body: { es: 'Pausa para observar el oasis y descensos amateur con las indicaciones del guía.', en: 'Pause to look over the oasis, followed by amateur sandboarding with guidance.' } },
        { title: { es: 'Regreso a la oficina', en: 'Return to the office' }, body: { es: 'Retorno al punto de encuentro tras aproximadamente una hora de recorrido.', en: 'Return to the meeting point after approximately one hour.' } }
      ],
      facts: [
        { label: { es: 'Unidad', en: 'Vehicle' }, value: { es: 'Hasta 3 pasajeros', en: 'Up to 3 passengers' } },
        { label: { es: 'Salida', en: 'Departure' }, value: { es: 'GO Adventure, Huacachina', en: 'GO Adventure, Huacachina' } },
        { label: { es: 'Equipo', en: 'Equipment' }, value: { es: 'Casco, lentes y tabla', en: 'Helmet, goggles and board' } }
      ],
      note: { es: 'Tarifa y turnos de demostración. Reserva online disponible para este recorrido.', en: 'Demonstration price and departures. Online booking is available for this tour.' },
      source: 'https://buganvillatours.com/utv-en-huacachina/'
    },
    {
      id: 'tubulares-sandboard', destination: 'huacachina',
      title: { es: 'Huacachina · Arenero y tabla', en: 'Huacachina · Buggy and boards' },
      region: { es: 'Huacachina · Ica', en: 'Huacachina · Ica' },
      description: { es: 'Dunas de Huacachina en arenero compartido, con paradas para sandboarding amateur. El turno y el punto de encuentro se coordinan antes de salir.', en: 'Explore the Huacachina dunes by shared buggy, with stops for amateur sandboarding. Departure time and meeting point are arranged before the tour.' },
      image: images.dunes, alt: imageMetadata.dunes.alt, imageSource: imageMetadata.dunes.source,
      duration: { es: '2 horas aprox.', en: 'Approx. 2 hours' }, durationHours: 2, pricePEN: 70,
      mode: { es: 'Recorrido compartido', en: 'Shared tour' }, category: { es: 'Desierto', en: 'Desert' },
      booking: 'consult', paxMin: 1, paxMax: 12,
      includes: { es: ['Propuesta de recorrido en arenero compartido', 'Equipo de sandboarding amateur', 'Coordinación del punto de encuentro'], en: ['Proposed shared dune buggy tour', 'Amateur sandboarding equipment', 'Meeting point coordination'] },
      excludes: { es: ['Alimentación', 'Traslados desde otras ciudades', 'Tasas locales, por confirmar'], en: ['Meals', 'Transfers from other cities', 'Local fees, to be confirmed'] },
      itinerary: [
        { title: { es: 'Preparación', en: 'Preparation' }, body: { es: 'Encuentro en Huacachina y explicación de la actividad antes de salir.', en: 'Meet in Huacachina and review the activity before departure.' } },
        { title: { es: 'Dunas y tabla', en: 'Dunes and boards' }, body: { es: 'Recorrido en arenero con paradas para realizar descensos amateur.', en: 'Dune buggy route with stops for amateur sandboarding descents.' } },
        { title: { es: 'Última luz', en: 'Evening light' }, body: { es: 'Pausa en las dunas y retorno. El atardecer depende de la hora y de las condiciones del día.', en: 'Pause among the dunes and return. Sunset viewing depends on departure time and daily conditions.' } }
      ],
      facts: [
        { label: { es: 'Modalidad', en: 'Format' }, value: { es: 'Compartido', en: 'Shared' } },
        { label: { es: 'Actividad', en: 'Activity' }, value: { es: 'Sandboarding amateur', en: 'Amateur sandboarding' } },
        { label: { es: 'Confirmación', en: 'Confirmation' }, value: { es: 'Con la agencia', en: 'With the agency' } }
      ],
      note: { es: 'Propuesta y tarifa referenciales. La agencia confirma disponibilidad, restricciones e inclusiones.', en: 'Indicative itinerary and price. The agency confirms availability, restrictions and inclusions.' }
    },
    {
      id: 'ballestas-paracas', destination: 'paracas',
      title: { es: 'Ballestas y Reserva de Paracas', en: 'Ballestas and Paracas Reserve' },
      region: { es: 'Paracas · Ica', en: 'Paracas · Ica' },
      description: { es: 'Salida en embarcación hacia las Islas Ballestas y recorrido terrestre por la Reserva Nacional de Paracas. La navegación depende de la apertura del puerto.', en: 'A boat trip to the Ballestas Islands and a land tour of Paracas National Reserve. Sailing depends on the port being open.' },
      image: images.paracas, alt: imageMetadata.paracas.alt, imageSource: imageMetadata.paracas.source,
      duration: { es: 'Medio día', en: 'Half day' }, durationHours: 5, pricePEN: 95,
      mode: { es: 'Navegación y recorrido terrestre', en: 'Cruise and land tour' }, category: { es: 'Litoral', en: 'Coast' },
      booking: 'consult', paxMin: 1, paxMax: 12,
      includes: { es: ['Propuesta de navegación a Ballestas', 'Recorrido propuesto por la reserva', 'Coordinación de horarios'], en: ['Proposed Ballestas Islands cruise', 'Proposed reserve tour', 'Departure coordination'] },
      excludes: { es: ['Tasas de embarque y entradas, por confirmar', 'Alimentación', 'Traslados desde Lima o Ica, salvo cotización'], en: ['Boarding fees and entry tickets, to be confirmed', 'Meals', 'Transfers from Lima or Ica unless quoted'] },
      itinerary: [
        { title: { es: 'Embarque en Paracas', en: 'Board in Paracas' }, body: { es: 'Presentación en el punto indicado por la agencia. La Capitanía define si el puerto puede operar.', en: 'Meet at the point specified by the agency. The harbour authority decides whether boats may operate.' } },
        { title: { es: 'Islas Ballestas', en: 'Ballestas Islands' }, body: { es: 'Navegación con observación de la costa y fauna marina desde la embarcación, sin desembarco en las islas.', en: 'Observe the coastline and marine wildlife from the boat, without landing on the islands.' } },
        { title: { es: 'Reserva costera', en: 'Coastal reserve' }, body: { es: 'Recorrido terrestre por paisajes de la Reserva Nacional de Paracas según la ruta acordada.', en: 'Explore the landscapes of Paracas National Reserve by land along the agreed route.' } }
      ],
      facts: [
        { label: { es: 'Entorno', en: 'Setting' }, value: { es: 'Costa del Pacífico', en: 'Pacific coast' } },
        { label: { es: 'Acceso', en: 'Access' }, value: { es: 'Sujeto al puerto', en: 'Subject to port opening' } },
        { label: { es: 'Salida', en: 'Departure' }, value: { es: 'Paracas', en: 'Paracas' } }
      ],
      note: { es: 'Propuesta y tarifa referenciales. Las entradas, los horarios y el transporte se detallan en la cotización.', en: 'Indicative itinerary and price. Entry tickets, schedules and transport are detailed in the quotation.' }
    },
    {
      id: 'lineas-nasca', destination: 'nasca',
      title: { es: 'Líneas de Nasca · Sobrevuelo', en: 'Nasca Lines · Scenic flight' },
      region: { es: 'Nasca · Ica', en: 'Nasca · Ica' },
      description: { es: 'Sobrevuelo de las figuras de Nasca desde el aeródromo local. Ruta, horario y condiciones se confirman con el operador aéreo.', en: 'Fly over the Nasca figures from the local airfield. Route, departure time and conditions are confirmed with the flight operator.' },
      image: images.nasca, alt: imageMetadata.nasca.alt, imageSource: imageMetadata.nasca.source,
      duration: { es: '35 min de vuelo aprox.', en: 'Approx. 35 min flight' }, durationHours: 0.6, pricePEN: 380,
      mode: { es: 'Sobrevuelo', en: 'Scenic flight' }, category: { es: 'Patrimonio', en: 'Heritage' },
      booking: 'consult', paxMin: 1, paxMax: 6,
      includes: { es: ['Propuesta de sobrevuelo', 'Coordinación con el operador aéreo', 'Indicaciones para el registro'], en: ['Proposed scenic flight', 'Flight operator coordination', 'Check-in instructions'] },
      excludes: { es: ['Tasas aeroportuarias y entradas, por confirmar', 'Traslado a Nasca, salvo cotización', 'Servicios no detallados por el operador'], en: ['Airport fees and entry tickets, to be confirmed', 'Transport to Nasca unless quoted', 'Services not specified by the operator'] },
      itinerary: [
        { title: { es: 'Registro y preparación', en: 'Check-in and preparation' }, body: { es: 'Presentación con documento en el aeródromo, controles del operador y explicación de la ruta.', en: 'Present your identification at the airfield, complete operator checks and receive a route briefing.' } },
        { title: { es: 'Lectura de la pampa', en: 'Reading the desert' }, body: { es: 'Sobrevuelo de las figuras según la ruta autorizada y las condiciones de visibilidad del día.', en: 'Fly over the figures along the authorised route, subject to the day’s visibility.' } },
        { title: { es: 'Retorno al aeródromo', en: 'Return to the airfield' }, body: { es: 'Aterrizaje y continuación del viaje. El horario puede ajustarse por operación o meteorología.', en: 'Land and continue your journey. Departure times may change due to operations or weather.' } }
      ],
      facts: [
        { label: { es: 'Punto de salida', en: 'Departure point' }, value: { es: 'Aeródromo de Nasca', en: 'Nasca airfield' } },
        { label: { es: 'Documento', en: 'Identification' }, value: { es: 'Obligatorio', en: 'Required' } },
        { label: { es: 'Condiciones', en: 'Conditions' }, value: { es: 'Según operador aéreo', en: 'Set by flight operator' } }
      ],
      note: { es: 'Tarifa referencial. Confirmar impuestos, restricciones, operador y condiciones antes de contratar.', en: 'Indicative price. Confirm taxes, restrictions, operator and terms before booking.' }
    },
    {
      id: 'ruta-pisco', destination: 'ica',
      title: { es: 'Ica · Bodegas y pisco', en: 'Ica · Wineries and pisco' },
      region: { es: 'Valle de Ica', en: 'Ica Valley' },
      description: { es: 'Visita a bodegas del valle de Ica para conocer la elaboración del pisco y el vino. Las bodegas y degustaciones se detallan en la propuesta.', en: 'Visit wineries in the Ica Valley to learn about pisco and wine production. Wineries and tastings are specified in the proposal.' },
      image: images.introMain, alt: imageMetadata.introMain.alt, imageSource: imageMetadata.introMain.source,
      duration: { es: '4 horas aprox.', en: 'Approx. 4 hours' }, durationHours: 4, pricePEN: 85,
      mode: { es: 'Visita y degustación', en: 'Visit and tasting' }, category: { es: 'Bodegas', en: 'Wineries' },
      booking: 'consult', paxMin: 1, paxMax: 12,
      includes: { es: ['Propuesta de visita a bodegas', 'Presentación del proceso del pisco', 'Degustación sujeta al programa y a la mayoría de edad'], en: ['Proposed winery visits', 'Introduction to pisco production', 'Tasting subject to the programme and legal drinking age'] },
      excludes: { es: ['Compras personales', 'Alimentación, salvo cotización', 'Accesos especiales o privados no confirmados'], en: ['Personal purchases', 'Meals unless quoted', 'Unconfirmed special or private access'] },
      itinerary: [
        { title: { es: 'Llegada al valle', en: 'Arrive in the valley' }, body: { es: 'Encuentro y traslado según la propuesta acordada con la agencia.', en: 'Meet and travel according to the itinerary agreed with the agency.' } },
        { title: { es: 'La bodega', en: 'The winery' }, body: { es: 'Recorrido por los espacios autorizados y explicación del proceso de producción.', en: 'Visit the authorised areas and learn about the production process.' } },
        { title: { es: 'Una cata del valle', en: 'A taste of the valley' }, body: { es: 'Degustación para mayores de edad cuando esté incluida en el programa y retorno.', en: 'Tasting for adults when included in the programme, followed by the return journey.' } }
      ],
      facts: [
        { label: { es: 'Territorio', en: 'Region' }, value: { es: 'Valle de Ica', en: 'Ica Valley' } },
        { label: { es: 'Degustación', en: 'Tasting' }, value: { es: 'Mayores de edad', en: 'Adults only' } },
        { label: { es: 'Fotografía', en: 'Photography' }, value: { es: 'Visita de Buganvilla a Tacama', en: 'Buganvilla visit to Tacama' } }
      ],
      note: { es: 'Propuesta y tarifa referenciales. La fotografía pertenece a una visita de Buganvilla a Tacama; las bodegas del programa se confirman en la cotización.', en: 'Indicative itinerary and price. The photograph shows a Buganvilla visit to Tacama; the programme’s wineries are confirmed in the quotation.' }
    }
  ];

  const packages = [
    {
      id: 'paracas-ica', destination: 'paracas', days: 2, nights: 1,
      title: { es: 'Paracas y Huacachina', en: 'Paracas and Huacachina' },
      region: { es: 'Paracas · Huacachina', en: 'Paracas · Huacachina' },
      description: { es: 'Ballestas y la Reserva de Paracas el primer día; Ica y las dunas de Huacachina el segundo. Una noche de alojamiento a cotizar.', en: 'Ballestas and Paracas Reserve on day one; Ica and the Huacachina dunes on day two. One night’s accommodation to be quoted.' },
      image: images.paracas, alt: imageMetadata.paracas.alt, imageSource: imageMetadata.paracas.source,
      duration: { es: '2 días · 1 noche', en: '2 days · 1 night' }, durationHours: 48,
      pricePEN: 690, booking: 'consult', paxMin: 2, paxMax: 9,
      mode: { es: 'Programa a medida', en: 'Tailored programme' }, category: { es: 'Mar y desierto', en: 'Sea and desert' },
      includes: { es: ['Propuesta de navegación a Ballestas', 'Visita propuesta a la reserva', 'Actividad en Huacachina a definir', 'Una noche de alojamiento a cotizar'], en: ['Proposed Ballestas cruise', 'Proposed reserve visit', 'Huacachina activity to be agreed', 'One night’s accommodation to be quoted'] },
      excludes: { es: ['Servicios no incluidos en la cotización', 'Tasas y entradas no confirmadas', 'Gastos personales'], en: ['Services excluded from the quotation', 'Unconfirmed fees and entry tickets', 'Personal expenses'] },
      itinerary: [
        { title: { es: 'Día 1 · Paracas y Ballestas', en: 'Day 1 · Paracas and Ballestas' }, body: { es: 'Llegada a Paracas, navegación a Ballestas según condiciones del puerto y recorrido por la reserva. Alojamiento sujeto a cotización.', en: 'Arrive in Paracas, cruise to Ballestas subject to port conditions and visit the reserve. Accommodation is subject to the quotation.' } },
        { title: { es: 'Día 2 · Ica y Huacachina', en: 'Day 2 · Ica and Huacachina' }, body: { es: 'Continuación hacia Ica y Huacachina. La actividad en dunas y el traslado de retorno se confirman con la agencia.', en: 'Continue to Ica and Huacachina. The dune activity and return transfer are confirmed with the agency.' } }
      ],
      facts: [
        { label: { es: 'Duración', en: 'Duration' }, value: { es: '2 días', en: '2 days' } },
        { label: { es: 'Alojamiento', en: 'Accommodation' }, value: { es: 'A cotizar', en: 'To be quoted' } },
        { label: { es: 'Formato', en: 'Format' }, value: { es: 'Adaptable', en: 'Flexible' } }
      ],
      note: { es: 'Programa orientativo desde S/ 690 por persona. Alojamiento, transporte, comidas y actividades se detallan en una cotización; no hay servicios confirmados al guardar este programa.', en: 'Indicative programme from S/ 690 per person. Accommodation, transport, meals and activities are detailed in a quotation; saving this programme does not confirm any services.' }
    },
    {
      id: 'sur-cuatro-dias', destination: 'ica', days: 4, nights: 3,
      title: { es: 'Paracas · Ica · Nasca', en: 'Paracas · Ica · Nasca' },
      region: { es: 'Paracas · Ica · Nasca', en: 'Paracas · Ica · Nasca' },
      description: { es: 'Cuatro días: Ballestas y Paracas, bodegas de Ica, dunas de Huacachina y Líneas de Nasca. Actividades y tres noches de alojamiento a cotizar.', en: 'Four days: Ballestas and Paracas, Ica wineries, Huacachina dunes and the Nasca Lines. Activities and three nights’ accommodation to be quoted.' },
      image: images.nasca, alt: imageMetadata.nasca.alt, imageSource: imageMetadata.nasca.source,
      duration: { es: '4 días · 3 noches', en: '4 days · 3 nights' }, durationHours: 96,
      pricePEN: 1480, booking: 'consult', paxMin: 2, paxMax: 9,
      mode: { es: 'Programa a medida', en: 'Tailored programme' }, category: { es: 'Sur peruano', en: 'Southern Peru' },
      includes: { es: ['Propuesta de recorrido por Paracas', 'Visita propuesta a bodegas en Ica', 'Opción de actividad en Huacachina', 'Propuesta de sobrevuelo en Nasca', 'Tres noches de alojamiento a cotizar'], en: ['Proposed Paracas itinerary', 'Proposed winery visits in Ica', 'Huacachina activity option', 'Proposed Nasca scenic flight', 'Three nights’ accommodation to be quoted'] },
      excludes: { es: ['Impuestos y servicios no confirmados', 'Comidas no detalladas en la cotización', 'Gastos personales'], en: ['Unconfirmed taxes and services', 'Meals not detailed in the quotation', 'Personal expenses'] },
      itinerary: [
        { title: { es: 'Día 1 · Paracas', en: 'Day 1 · Paracas' }, body: { es: 'Llegada a la costa y visita según horario. Navegación sujeta a apertura del puerto.', en: 'Arrive on the coast and visit according to the schedule. Cruises depend on port opening.' } },
        { title: { es: 'Día 2 · Bodegas de Ica', en: 'Day 2 · Ica wineries' }, body: { es: 'Continuación hacia Ica y visita a bodegas seleccionadas en la cotización.', en: 'Continue to Ica and visit the wineries selected in the quotation.' } },
        { title: { es: 'Día 3 · Huacachina', en: 'Day 3 · Huacachina' }, body: { es: 'Tiempo en el oasis y una actividad en dunas según preferencias y disponibilidad.', en: 'Time in the oasis and a dune activity based on preferences and availability.' } },
        { title: { es: 'Día 4 · Nasca', en: 'Day 4 · Nasca' }, body: { es: 'Ruta hacia la pampa. El sobrevuelo requiere confirmación del operador aéreo; después, continuación o retorno acordado.', en: 'Travel towards the desert. The scenic flight requires flight operator confirmation, followed by the agreed continuation or return.' } }
      ],
      facts: [
        { label: { es: 'Duración', en: 'Duration' }, value: { es: '4 días', en: '4 days' } },
        { label: { es: 'Territorios', en: 'Regions' }, value: { es: 'Paracas, Ica y Nasca', en: 'Paracas, Ica and Nasca' } },
        { label: { es: 'Pernoctes', en: 'Overnight stays' }, value: { es: '3 noches a cotizar', en: '3 nights to be quoted' } }
      ],
      note: { es: 'Programa y tarifa referenciales. Cada actividad, traslado y alojamiento se detalla y confirma en la cotización de la agencia.', en: 'Indicative itinerary and price. Each activity, transfer and accommodation is detailed and confirmed in the agency’s quotation.' }
    },
    {
      id: 'ica-lima', destination: 'ica', days: 1, nights: 0,
      title: { es: 'Ica desde Lima', en: 'Ica from Lima' },
      region: { es: 'Lima · Ica · Huacachina', en: 'Lima · Ica · Huacachina' },
      description: { es: 'Ida y vuelta desde Lima, visita a una bodega de Ica y parada en Huacachina. Transporte, horarios y actividad en dunas se confirman en la cotización.', en: 'A return trip from Lima, an Ica winery visit and a stop in Huacachina. Transport, timing and the dune activity are confirmed in the quotation.' },
      image: images.dunes, alt: imageMetadata.dunes.alt, imageSource: imageMetadata.dunes.source,
      duration: { es: '1 día', en: '1 day' }, durationHours: 14,
      pricePEN: 320, booking: 'consult', paxMin: 2, paxMax: 12,
      mode: { es: 'Programa a medida', en: 'Tailored programme' }, category: { es: 'Valle y oasis', en: 'Valley and oasis' },
      includes: { es: ['Propuesta de transporte de ida y vuelta', 'Visita propuesta a una bodega', 'Actividad en Huacachina a definir'], en: ['Proposed return transport', 'Proposed winery visit', 'Huacachina activity to be agreed'] },
      excludes: { es: ['Alimentación, salvo cotización', 'Entradas o tasas no detalladas', 'Servicios fuera del programa confirmado'], en: ['Meals unless quoted', 'Entry tickets or fees not specified', 'Services outside the confirmed itinerary'] },
      itinerary: [
        { title: { es: 'Salida de Lima', en: 'Depart from Lima' }, body: { es: 'Recojo y viaje hacia Ica en el transporte cotizado. Punto y horario a confirmar.', en: 'Meet and travel to Ica using the quoted transport. Pickup location and time are to be confirmed.' } },
        { title: { es: 'Bodega y valle', en: 'Winery and valley' }, body: { es: 'Visita según el programa acordado y pausa de alimentación a coordinar.', en: 'Visit according to the agreed programme, with a meal break to be coordinated.' } },
        { title: { es: 'Huacachina y retorno', en: 'Huacachina and return' }, body: { es: 'Tiempo en el oasis y actividad en dunas si está incluida. Retorno a Lima según el horario confirmado.', en: 'Time in the oasis and a dune activity if included. Return to Lima according to the confirmed schedule.' } }
      ],
      facts: [
        { label: { es: 'Duración', en: 'Duration' }, value: { es: 'Una jornada', en: 'One day' } },
        { label: { es: 'Origen', en: 'Origin' }, value: { es: 'Lima', en: 'Lima' } },
        { label: { es: 'Pernocte', en: 'Overnight' }, value: { es: 'Sin alojamiento', en: 'No overnight stay' } }
      ],
      note: { es: 'Programa y tarifa referenciales. Transporte, actividad y comidas se precisan en la cotización de la agencia.', en: 'Indicative itinerary and price. Transport, activity and meals are specified in the agency’s quotation.' }
    }
  ];

  window.PremiumCatalog = {
    tours, packages, images, imageMetadata,
    reviews: [
      { author: 'Tourist823113', topic: { es: 'Atención al viajero', en: 'Traveller support' }, title: { es: 'Acompañamiento atento', en: 'Attentive support' }, text: { es: 'Anyelin ayudó a resolver sus consultas durante el viaje.', en: 'Anyelin helped answer their questions during the trip.' }, date: { es: 'Noviembre de 2023', en: 'November 2023' }, source: 'https://buganvillatours.com/utv-en-huacachina/' },
      { author: 'Kiari_94', topic: { es: 'Paracas y Ballestas', en: 'Paracas and Ballestas' }, title: { es: 'Una visita bien coordinada', en: 'A well-coordinated visit' }, text: { es: 'Una visita a Paracas y Ballestas bien coordinada.', en: 'A well-coordinated visit to Paracas and Ballestas.' }, source: 'https://buganvillatours.com/utv-en-huacachina/' },
      { author: 'Stefannycondemarin', topic: { es: 'Guías y servicio', en: 'Guides and service' }, title: { es: 'Conocimiento local', en: 'Local knowledge' }, text: { es: 'Guías que conocen la zona y una movilidad cuidada.', en: 'Guides who know the area and well-kept transport.' }, source: 'https://buganvillatours.com/utv-en-huacachina/' }
    ],
    contact: {
      phone: '51948401267', displayPhone: '+51 948 401 267',
      phones: ['+51 948 401 267', '+51 947 929 246'],
      email: 'reservas@buganvillatours.com.pe',
      location: { es: 'Ica, Perú · Punto de encuentro según el recorrido', en: 'Ica, Peru · Meeting point depends on the tour' },
      mapsURL: 'https://www.google.com/maps/search/?api=1&query=Huacachina+Ica+Peru',
      source: 'https://buganvillatours.com/utv-en-huacachina/'
    },
    destinations: [
      { id: 'all', name: { es: 'Todos', en: 'All' } },
      { id: 'huacachina', name: { es: 'Huacachina', en: 'Huacachina' } },
      { id: 'paracas', name: { es: 'Paracas', en: 'Paracas' } },
      { id: 'nasca', name: { es: 'Nasca', en: 'Nasca' } },
      { id: 'ica', name: { es: 'Valle de Ica', en: 'Ica Valley' } }
    ],
    exchangeRates: { PEN: 1, USD: 3.75, EUR: 4.1 },
    demo: true,
    notice: { es: 'Catálogo de demostración. Tarifas referenciales; los servicios sujetos a consulta se confirman con la agencia.', en: 'Demonstration catalogue. Indicative prices; services offered by enquiry are confirmed with the agency.' },
    reviewNote: { es: 'Resúmenes editoriales de reseñas publicadas en la web de Buganvilla. No son citas textuales.', en: 'Editorial summaries of reviews published on Buganvilla’s website. They are not direct quotations.' },
    photographyNote: { es: 'Fotografías reales publicadas por Buganvilla Tours: UTV, viajeros y sandboarding en Huacachina; visita a Tacama en Ica; fauna de las Islas Ballestas. Paisajes de Huacachina y Nasca verificados en Unsplash.', en: 'Real photographs published by Buganvilla Tours: UTVs, travellers and sandboarding in Huacachina; a Tacama visit in Ica; Ballestas Islands wildlife. Huacachina and Nasca landscapes verified on Unsplash.' }
  };
  window.PremiumCatalog.reviews.forEach(review => {
    review.summary = review.text;
    review.theme = review.topic;
  });
})();
