import { knownCoordinates } from "./place-service";
import type { Zoo } from "./zoo-data";

export type UserCoordinates = { latitude: number; longitude: number };

export function zooCoordinates(zoo: Zoo): [number, number] | null {
  if (zoo.latitude != null && zoo.longitude != null) return [zoo.latitude, zoo.longitude];
  return knownCoordinates[zoo.id] || null;
}

export function distanceFromUser(user: UserCoordinates, zoo: Zoo) {
  const coordinates = zooCoordinates(zoo);
  if (!coordinates) return null;
  const toRadians = (value: number) => value * Math.PI / 180;
  const [latitude, longitude] = coordinates;
  const latitudeDelta = toRadians(latitude - user.latitude);
  const longitudeDelta = toRadians(longitude - user.longitude);
  const startLatitude = toRadians(user.latitude);
  const endLatitude = toRadians(latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function destination(zoo: Zoo) {
  const coordinates = zooCoordinates(zoo);
  return coordinates ? coordinates.join(",") : `${zoo.name}, ${zoo.city}, ${zoo.countryName}`;
}

export function googleMapsDirectionsUrl(zoo: Zoo) {
  const query = new URLSearchParams({ api: "1", destination: destination(zoo), travelmode: "driving", dir_action: "navigate" });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

export function wazeDirectionsUrl(zoo: Zoo) {
  const coordinates = zooCoordinates(zoo);
  const query = coordinates
    ? new URLSearchParams({ ll: coordinates.join(","), navigate: "yes", utm_source: "our-zoo-journal" })
    : new URLSearchParams({ q: destination(zoo), navigate: "yes", utm_source: "our-zoo-journal" });
  return `https://waze.com/ul?${query.toString()}`;
}
