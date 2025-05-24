import { CheckpointSilver, CheckpointViolet, Marisol } from '../utils/jeepRoutes';
import { JeepneyRoute } from '../utils/routeTypes';

export const allJeepneyRoutes: JeepneyRoute[] = [
  { 
    id: 'checkpointSilver', 
    name: 'Checkpoint Silver', 
    coordinates: CheckpointSilver, 
    color: '#C0C0C0' 
  },
  { 
    id: 'checkpointViolet', 
    name: 'Checkpoint Violet', 
    coordinates: CheckpointViolet, 
    color: '#9488d3'
  },
  { 
    id: 'marisol', 
    name: 'Marisol', 
    coordinates: Marisol, 
    color: '#12942d'
  },
];

export const getJeepneyRouteById = (id: string): JeepneyRoute | undefined => {
  return allJeepneyRoutes.find(route => route.id === id);
};

