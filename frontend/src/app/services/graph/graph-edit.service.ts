import { Injectable } from '@angular/core';
import { GraphStateService, D3Node, D3Link } from './graph-state.service';
import { GraphRenderService } from './graph-render.service';
import { GraphService } from "../api/graph.service";
import { ProfileApiService } from '../api/profile.api';
import { HouseChangeInterface, StreetChangeInterface, StreetInterface } from '../../../generated';

@Injectable({ providedIn: 'root' })
export class GraphEditService {
    constructor(
        private state: GraphStateService,
        private render: GraphRenderService,
        private graphService: GraphService,
        private profileApi: ProfileApiService,
    ) {}

    // ─── Node ─────────────────────────────────────────────────────────────────

    async addNode(x: number, y: number) {
        try {
            const dto: HouseChangeInterface = {
                id: crypto.randomUUID(),
                action: 'add',
                category: 0,
                time: 0,
                price: 0,
                weather: false,
            };
            const resp = await this.graphService.changeHouse(dto);
            this.profileApi.currentUser.set(resp);

            const newHouse = resp.city!.houses!.at(-1)!;
            const newNode: D3Node = {
                id: newHouse.id, category: newHouse.category,
                house: newHouse, x, y,
            };

            this.state.houses = [...this.state.houses, newHouse];
            this.state.d3Nodes.push(newNode);
            this.render.simulation.nodes(this.state.d3Nodes);
            this.render.addNodeToGraph(newNode);
            this.render.simulation.alpha(0.3).restart();
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при добавлении вершины');
        }
    }

    async changeHouseCategory(categoryId: number) {
        const house = this.state.selectedHouse();
        if (!house) return;

        // Обновляем локально сразу
        house.category = categoryId;
        const node = this.state.d3Nodes.find(n => n.id === house.id);
        if (node) {
            node.category = categoryId;
            this.render.updateNodeIcon(house.id, categoryId);
        }

        try {
            const dto: HouseChangeInterface = {
                id: house.id,
                category: categoryId,
                time: house.time,
                price: house.price,
                weather: house.weather as boolean,
                action: 'change',
            };
            const resp = await this.graphService.changeHouse(dto);
            this.profileApi.currentUser.set(resp);
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при изменении категории');
        }
    }

    async deleteHouse() {
        const house = this.state.selectedHouse();
        if (!house) return;
        const id = house.id;

        // Удаляем локально сразу
        this.state.selectedHouse.set(null);
        this.state.houses = this.state.houses.filter(h => h.id !== id);
        this.state.d3Nodes = this.state.d3Nodes.filter(n => n.id !== id);
        this.state.d3Links = this.state.d3Links.filter(l =>
            (l.source as D3Node).id !== id && (l.target as D3Node).id !== id
        );

        this.render.removeNodeFromGraph(id);
        this.render.syncLinks();
        this.render.simulation.nodes(this.state.d3Nodes);
        this.render.simulation.alpha(0.1).restart();

        try {
            const dto: HouseChangeInterface = {
                id,
                category: house.category,
                time: house.time,
                price: house.price,
                weather: house.weather as boolean,
                action: 'delete',
            };
            const resp = await this.graphService.changeHouse(dto);
            this.profileApi.currentUser.set(resp);
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при удалении вершины');
        }
    }

    // ─── Edge ─────────────────────────────────────────────────────────────────

    async handleEdgeClick(targetNode: D3Node) {
        const source = this.state.edgeSourceNode();

        if (!source) {
            this.state.edgeSourceNode.set(targetNode);
            this.render.updateNodeStyles();
            return;
        }
        if (source.id === targetNode.id) {
            this.state.edgeSourceNode.set(null);
            this.render.updateNodeStyles();
            return;
        }

        this.state.edgeSourceNode.set(null);

        try {
            const dto: StreetChangeInterface = {
                id: `${source.id}:${targetNode.id}`,
                length: 10,
                action: 'add',
            };
            const resp = await this.graphService.changeStreet(dto);
            this.profileApi.currentUser.set(resp);

            const newStreet = {
                id: dto.id, from: source.id,
                to: targetNode.id, length: 10,
            } as StreetInterface;

            this.state.streets = [...this.state.streets, newStreet];
            this.state.streetSet.add(newStreet.id);
            this.state.d3Links.push({
                id: newStreet.id, length: 10,
                source: source.id, target: targetNode.id,
            });

            this.render.syncLinks();
            this.render.simulation.alpha(0.3).restart();
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при добавлении ребра');
        }
    }

    async saveStreetLength() {
        const street = this.state.selectedStreet();
        if (!street) return;
        const id = street.id;
        const newLength = this.state.editingStreetLength();

        street.length = newLength;
        const s = this.state.streets.find(s => s.id === id);
        if (s) s.length = newLength;
        const link = this.state.d3Links.find(l => l.id === id);
        if (link) link.length = newLength;

        this.render.syncLinks();

        try {
            const resp = await this.graphService.changeStreet({
                id, length: newLength, action: 'change',
            });
            this.profileApi.currentUser.set(resp);
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при изменении ребра');
        }
    }

    async deleteStreet() {
        const street = this.state.selectedStreet();
        if (!street) return;
        const id = street.id;

        this.state.streets = this.state.streets.filter(s => s.id !== id);
        this.state.streetSet.delete(id);
        this.state.d3Links = this.state.d3Links.filter(l => l.id !== id);
        this.state.selectedStreet.set(null);

        this.render.syncLinks();
        this.render.simulation.alpha(0.1).restart();

        try {
            const resp = await this.graphService.changeStreet({
                id, length: 0, action: 'delete',
            });
            this.profileApi.currentUser.set(resp);
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при удалении ребра');
        }
    }

    // ─── City ─────────────────────────────────────────────────────────────────

    async generateCity(count: number | null) {
        this.state.isGenerating.set(true);
        this.state.error.set(null);
        try {
            const resp = count && count > 0
                ? await this.graphService.generateRandomCityByModel({ count })
                : await this.graphService.generateRandomCity();

            this.profileApi.currentUser.set(resp);
            this.state.reset();
        } catch (e: any) {
            this.state.error.set(e?.message ?? 'Ошибка при генерации города');
        } finally {
            this.state.isGenerating.set(false);
        }
    }
}