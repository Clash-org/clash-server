import { CityService } from "../services/city.service.js";
import { citySchema } from "../schemas/auth.schema.js";

const cityService = new CityService();

export const cityRoutes = {
  async getAll() {
    return await cityService.getAll();
  },

  async getById(id: number) {
    const city = await cityService.getById(id);
    if (!city) throw new Error("City not found");
    return city;
  },

  async create(body: unknown) {
    const input = citySchema.parse(body);
    return await cityService.create(input.title);
  },

  async delete(id: number) {
    return await cityService.delete(id);
  }
};