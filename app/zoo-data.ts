export type Country = "NL" | "BE" | "DE";
export type AnimalKey =
  | "giraffe"
  | "elephant"
  | "lion"
  | "redpanda"
  | "monkey"
  | "tiger"
  | "bear"
  | "flamingo"
  | "penguin"
  | "otter"
  | "seal"
  | "goat";

export type Rating1to5 = 1 | 2 | 3 | 4 | 5;

export type Zoo = {
  id: string;
  name: string;
  city: string;
  country: Country;
  countryName: string;
  distance: number; // km
  driveMinutes: number;
  price: number;
  dealPrice?: number;
  dealLabel?: string;
  website: string;
  visited: boolean;
  animal: AnimalKey;
  color: string;
  intro: string;
  highlights: string[];
  animalNames?: string[];
  about: string;
  animalsText: string;
  infoText: string;
  potential: { romantic: Rating1to5; animals: Rating1to5; food: Rating1to5; travel: Rating1to5 };
  scores?: { overall: number; animals: number; pretty: number; food: number; date: number; value: number };
  reviewNote?: string;
  memory?: { caption: string; date: string };
  category?: "zoo" | "aquarium" | "petting-zoo" | "animal-park";
  latitude?: number;
  longitude?: number;
  source?: "curated" | "openstreetmap" | "custom";
  openingHours?: string;
  address?: string;
  phone?: string;
  wikipedia?: string;
};

export const zoos: Zoo[] = [
  {
    id: "burgers",
    name: "Burgers’ Zoo",
    city: "Arnhem",
    country: "NL",
    countryName: "Nederland",
    distance: 46,
    driveMinutes: 38,
    price: 27.5,
    dealPrice: 22.5,
    dealLabel: "Online -18%",
    website: "https://www.burgerszoo.nl",
    visited: false,
    animal: "lion",
    color: "#abc2a8",
    intro: "Reis op één dag door de Bush, Desert en Ocean.",
    highlights: ["Bush", "Mangrove", "Ocean"],
    animalNames: ["leeuw", "okapi", "gorilla", "haai", "zeekoe", "aardvarken", "chimpansee", "rode panda"],
    about: "Burgers’ Zoo is beroemd om zijn immersieve biotopen. Je loopt zo van tropisch regenwoud naar woestijn en oceaan zonder de deur uit te gaan.",
    animalsText: "Leeuwen, okapi's, gorilla's, haaien in het Ocean-aquarium en vrij rondvliegende vogels in de Bush.",
    infoText: "Ruime parkeerplaats, restaurants verspreid door het park en grotendeels rolstoelvriendelijk.",
    potential: { romantic: 4, animals: 5, food: 4, travel: 5 },
  },
  {
    id: "gaia",
    name: "GaiaZOO",
    city: "Kerkrade",
    country: "NL",
    countryName: "Nederland",
    distance: 178,
    driveMinutes: 105,
    price: 25.5,
    dealPrice: 19.5,
    dealLabel: "Social deal -24%",
    website: "https://www.gaiazoo.nl",
    visited: false,
    animal: "giraffe",
    color: "#e8c18f",
    intro: "Een heuvelachtig dierenpark vol bijzondere werelden, midden in Zuid-Limburg.",
    highlights: ["Savanna", "Limburg", "Giraffes"],
    animalNames: ["giraffe", "neushoorn", "leeuw", "gorilla", "flamingo", "wolf", "rode panda", "veelvraat"],
    about: "GaiaZOO is een beeldschone dierentuin met focus op natuur en behoud, verspreid over de Limburgse heuvels. Reis de wereld rond in één dag.",
    animalsText: "Giraffes, neushoorns, wolven en een indrukwekkend nachtdierenverblijf.",
    infoText: "Er zijn steile paadjes, dus comfortabele schoenen zijn aanbevolen.",
    potential: { romantic: 5, animals: 5, food: 4, travel: 4 },
  },
  {
    id: "blijdorp",
    name: "Diergaarde Blijdorp",
    city: "Rotterdam",
    country: "NL",
    countryName: "Nederland",
    distance: 84,
    driveMinutes: 55,
    price: 29.5,
    website: "https://www.diergaardeblijdorp.nl",
    visited: false,
    animal: "elephant",
    color: "#b9d2ce",
    intro: "Monumentale dierentuin met Oceanium midden in Rotterdam.",
    highlights: ["Oceanium", "Monumenten"],
    animalNames: ["olifant", "haai", "rog", "ijsbeer", "giraffe", "gorilla", "rode panda", "okapi"],
    about: "Een van de oudste dierentuinen van Nederland, met prachtige monumentale gebouwen en het imposante Oceanium.",
    animalsText: "Olifanten, haaien en roggen in het Oceanium, ijsberen en een grote vogelvolière.",
    infoText: "Goed bereikbaar met het openbaar vervoer, direct naast metrostation Blijdorp.",
    potential: { romantic: 4, animals: 4, food: 3, travel: 4 },
  },
  {
    id: "pairi",
    name: "Pairi Daiza",
    city: "Brugelette",
    country: "BE",
    countryName: "België",
    distance: 238,
    driveMinutes: 150,
    price: 42,
    dealLabel: "Geen bekende korting",
    website: "https://www.pairidaiza.eu",
    visited: false,
    animal: "redpanda",
    color: "#d4b9c7",
    intro: "Een sprookjesachtige wereldreis tussen tuinen en tempels.",
    highlights: ["Panda's", "Tuinen", "Trein"],
    animalNames: ["reuzenpanda", "koala", "olifant", "walrus", "orang-oetan", "tijger", "rode panda", "pinguïn"],
    about: "Pairi Daiza voelt als een reis door de hele wereld in één dag. Je ontdekt Chinese tempels, Franse tuinen en een eigen treintje tussen de gebieden.",
    animalsText: "Grote panda's, koalas en een enorme verzameling vogels in walk-through volières.",
    infoText: "Trek er een hele dag voor uit, want het park is groot en de tijden zijn seizoensafhankelijk.",
    potential: { romantic: 5, animals: 5, food: 4, travel: 2 },
  },
  {
    id: "antwerpen",
    name: "ZOO Antwerpen",
    city: "Antwerpen",
    country: "BE",
    countryName: "België",
    distance: 146,
    driveMinutes: 95,
    price: 32.5,
    dealPrice: 27.5,
    dealLabel: "CJP -15%",
    website: "https://www.zooantwerpen.be",
    visited: false,
    animal: "flamingo",
    color: "#e7b2a5",
    intro: "Historische stadsdierentuin naast het centraal station.",
    highlights: ["Historisch", "Stadspark"],
    animalNames: ["flamingo", "okapi", "leeuw", "gorilla", "olifant", "giraffe", "pinguïn", "zeehond"],
    about: "Sinds 1843 middenin de stad, met prachtige negentiende-eeuwse gebouwen en een beroemde flamingokolonie bij de ingang.",
    animalsText: "Flamingo's, okapi's (hier voor het eerst gefokt!) en een Nachtsafari.",
    infoText: "Direct naast Antwerpen-Centraal; een auto is dus niet nodig.",
    potential: { romantic: 4, animals: 4, food: 3, travel: 3 },
  },
  {
    id: "apenheul",
    name: "Apenheul",
    city: "Apeldoorn",
    country: "NL",
    countryName: "Nederland",
    distance: 38,
    driveMinutes: 32,
    price: 28,
    dealPrice: 17.5,
    dealLabel: "Voorbeeldkorting -37%",
    website: "https://www.apenheul.nl",
    visited: false,
    animal: "monkey",
    color: "#bac99d",
    intro: "Wandel tussen honderden loslopende apen in het groen.",
    highlights: ["Loslopende apen", "Bos"],
    animalNames: ["gorilla", "doodshoofdaap", "orang-oetan", "bonobo", "brulaap", "maki", "neusaap", "berberaap"],
    about: "Uniek in Europa: gorilla's, doodshoofdaapjes en veel andere soorten lopen hier gewoon los tussen de bezoekers door.",
    animalsText: "Gorilla's, doodshoofdaapjes, orang-oetans en brulapen.",
    infoText: "Laat losse spullen zoals petjes en zonnebrillen in de auto, want de apen zijn nieuwsgierig.",
    potential: { romantic: 4, animals: 5, food: 3, travel: 5 },
  },
  {
    id: "leipzig",
    name: "Zoo Leipzig",
    city: "Leipzig",
    country: "DE",
    countryName: "Duitsland",
    distance: 574,
    driveMinutes: 340,
    price: 24,
    website: "https://www.zoo-leipzig.de",
    visited: false,
    animal: "tiger",
    color: "#dec28e",
    intro: "Gondwanaland brengt een tropisch regenwoud naar Duitsland.",
    highlights: ["Gondwanaland", "Boottocht"],
    animalNames: ["tijger", "olifant", "giraffe", "chimpansee", "gorilla", "okapi", "luiaard", "pinguïn"],
    about: "Een van de modernste dierentuinen van Europa, met Gondwanaland als grootste overdekte regenwoudhal.",
    animalsText: "Tijgers, olifanten en een boottocht dwars door het regenwoud in Gondwanaland.",
    infoText: "Reken op een lange rit en combineer het bezoek eventueel met een overnachting.",
    potential: { romantic: 3, animals: 5, food: 3, travel: 1 },
  },
  {
    id: "berlin",
    name: "Zoo Berlin",
    city: "Berlin",
    country: "DE",
    countryName: "Duitsland",
    distance: 654,
    driveMinutes: 390,
    price: 25.5,
    website: "https://www.zoo-berlin.de",
    visited: false,
    animal: "bear",
    color: "#b7c9d2",
    intro: "Een beroemde stadszoo met ongelooflijk veel diersoorten.",
    highlights: ["Panda's", "Aquarium"],
    animalNames: ["reuzenpanda", "ijsbeer", "olifant", "giraffe", "leeuw", "gorilla", "orang-oetan", "nijlpaard"],
    about: "Dit is Duitslands oudste dierentuin en een van de soortenrijkste ter wereld. Er is zelfs een eigen pandaverblijf.",
    animalsText: "Panda's, ijsberen en een spectaculair aquarium met haaienbassin.",
    infoText: "Goed te combineren met station Zoologischer Garten, midden in Berlijn.",
    potential: { romantic: 3, animals: 5, food: 3, travel: 1 },
  },
];

export const animalLabel: Record<AnimalKey, string> = {
  giraffe: "giraffe",
  elephant: "olifant",
  lion: "leeuw",
  redpanda: "rode panda",
  monkey: "aap",
  tiger: "tijger",
  bear: "beer",
  flamingo: "flamingo",
  penguin: "pinguïn",
  otter: "otter",
  seal: "zeehond",
  goat: "geit",
};

export const bucketList = [
  { label: "Zie een rode panda", done: false },
  { label: "Voer de giraffes", done: true },
  { label: "Bezoek een dierentuin in Duitsland", done: false },
  { label: "Maak de schattigste foto", done: true },
];
