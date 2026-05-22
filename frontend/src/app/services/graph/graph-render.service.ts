import { Injectable, NgZone } from '@angular/core';
import * as d3 from 'd3';
import { GraphStateService, D3Node, D3Link } from './graph-state.service';

@Injectable({ providedIn: 'root' })
export class GraphRenderService {
    private svg!: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    private g!: d3.Selection<SVGGElement, unknown, null, undefined>;
    private zoomBehavior!: d3.ZoomBehavior<SVGSVGElement, unknown>;
    simulation!: d3.Simulation<D3Node, D3Link>;
    width = 900;
    height = 600;

    // Callbacks для событий — устанавливает компонент
    onNodeClick?: (d: D3Node) => void;
    onLinkClick?: (d: D3Link) => void;
    onCanvasClick?: (x: number, y: number) => void;

    constructor(
        private state: GraphStateService,
        private ngZone: NgZone,
    ) {
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    init(el: SVGSVGElement) {
        this.width = el.clientWidth || 900;
        this.height = el.clientHeight || 600;

        this.svg = d3.select(el);
        this.svg.selectAll('*').remove();

        this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .filter(event => {
                if (this.state.editMode() !== 'select') return false;
                return !event.button;
            })
            .on('zoom', event => this.g.attr('transform', event.transform));

        this.svg.call(this.zoomBehavior);

        this.svg.append('rect')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('fill', 'transparent');

        this.svg.on('click', event => {
            const tag = (event.target as SVGElement).tagName;
            if (tag === 'svg' || tag === 'rect') {
                if (this.state.editMode() === 'add-node') {
                    const transform = d3.zoomTransform(el);
                    const [x, y] = transform.invert(d3.pointer(event));
                    this.ngZone.run(() => this.onCanvasClick?.(x, y));
                } else {
                    this.ngZone.run(() => this.onCanvasClick?.(-1, -1));
                }
            }
        });

        this.g = this.svg.append('g');
    }

    destroy() {
        this.simulation?.stop();
    }

    // ─── Simulation ───────────────────────────────────────────────────────────

    buildSimulation() {
        this.simulation?.stop();

        const hasLayoutCoords = this.state.d3Nodes.every(
            n => n.house.x !== undefined && n.house.y !== undefined
        );

        if (hasLayoutCoords) {
            this.applyBackendLayout();
        }

        const connectedIds = new Set<string>();
        this.state.d3Links.forEach(link => {
            connectedIds.add(typeof link.source === 'string' ? link.source : (link.source as D3Node).id);
            connectedIds.add(typeof link.target === 'string' ? link.target : (link.target as D3Node).id);
        });

        this.simulation = d3.forceSimulation<D3Node, D3Link>(this.state.d3Nodes)
            .force('link', d3.forceLink<D3Node, D3Link>(this.state.d3Links)
                .id(d => d.id)
                .distance(130)
                .strength(0)
            )
            .force('charge', d3.forceManyBody()
                .strength(d => connectedIds.has((d as D3Node).id) ? -400 : -80)
                .distanceMax(400)
            )
            .force('center', null)
            .force('collision', d3.forceCollide(13))
            .alphaDecay(0.02)
            .velocityDecay(0.4)
            .alpha(0.8)
            .on('tick', () => this.ticked())
            .on('end', () => this.fitGraph());
    }

    private applyBackendLayout() {
        if (this.state.d3Nodes.length === 0) return;

        // Находим границы координат с бэка
        const xs = this.state.d3Nodes.map(n => n.house.x ?? 0);
        const ys = this.state.d3Nodes.map(n => n.house.y ?? 0);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const rangeX = maxX - minX || 1;
        const rangeY = maxY - minY || 1;
        const n = this.state.d3Nodes.length;

        const padding = 80;
        let multi;
        if (n < 100) multi = 2;
        else if (n < 250) multi = n / 70;
        else if (n < 500) multi = n / 100;
        else multi = n / 200;

        const scaleX = (this.width * multi - padding * 2) / rangeX;
        const scaleY = (this.height * multi - padding * 2) / rangeY;
        const scale = Math.min(scaleX, scaleY);

        // Масштабируем и центрируем
        const offsetX = (this.width - rangeX * scale) / 2;
        const offsetY = (this.height - rangeY * scale) / 2;

        for (const node of this.state.d3Nodes) {
            node.x = offsetX + ((node.house.x ?? 0) - minX) * scale;
            node.y = offsetY + ((node.house.y ?? 0) - minY) * scale;
            // Слегка фиксируем — симуляция может чуть двигать, но не далеко
            node.fx = node.x;
            node.fy = node.y;
        }

        // Размораживаем через секунду — после первичной отрисовки
        setTimeout(() => {
            for (const node of this.state.d3Nodes) {
                node.fx = null;
                node.fy = null;
            }
            this.fitGraph();
            this.simulation?.alpha(0.1).restart();
        }, 800);
    }

    focusOn(x: number, y: number, scale = 1.8) {
        if (!this.svg || !this.zoomBehavior) return;

        const tx = this.width / 2 - x * scale;
        const ty = this.height / 2 - y * scale;

        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

        this.svg.transition()
            .duration(500)
            .call(this.zoomBehavior.transform, transform);

        this.g.transition()
            .duration(500)
            .attr('transform', transform.toString());
    }

    // ─── Render ───────────────────────────────────────────────────────────────

    renderGraph() {
        if (!this.g) return;
        this.g.selectAll('*').remove();
        this.g.append('g').attr('class', 'links');
        this.g.append('g').attr('class', 'link-labels');
        this.syncLinks();
        this.renderNodes();
    }

    private renderNodes() {
        const nodeGroup = this.g.append('g').attr('class', 'nodes')
            .selectAll('g')
            .data(this.state.d3Nodes)
            .enter().append('g')
            .attr('class', 'graph-node')
            .attr('cursor', 'pointer')
            .call(d3.drag<SVGGElement, D3Node>()
                .on('start', (e, d) => this.dragStarted(e, d))
                .on('drag', (e, d) => this.dragged(e, d))
                .on('end', (e, d) => this.dragEnded(e, d))
            )
            .on('click', (event, d) => {
                event.stopPropagation();
                this.ngZone.run(() => this.onNodeClick?.(d));
            });

        nodeGroup.append('circle').attr('class', 'node-glow')
            .attr('r', 30).attr('fill', 'transparent')
            .attr('stroke', 'transparent').attr('stroke-width', 10);

        nodeGroup.append('circle').attr('class', 'node-circle')
            .attr('r', 22).attr('fill', '#0f0f23')
            .attr('stroke', '#3b3b6b').attr('stroke-width', 2);

        nodeGroup.append('text').attr('class', 'node-icon')
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
            .attr('font-size', '15px').attr('y', 0)
            .text(d => this.state.houseCategories[d.category]?.icon ?? '📍');

        nodeGroup.append('text').attr('class', 'node-label')
            .attr('text-anchor', 'middle').attr('y', 35)
            .attr('fill', '#6b7280').attr('font-size', '9px')
            .attr('letter-spacing', '0.5px')
            .text(d => this.state.houseCategories[d.category]?.name ?? '');
    }

    syncLinks() {
        if (!this.g) return;

        this.g.select('.links')
            .selectAll<SVGLineElement, D3Link>('line')
            .data(this.state.d3Links, d => d.id)
            .join(
                enter => enter.append('line')
                    .attr('class', 'graph-link')
                    .attr('cursor', 'pointer')
                    .attr('stroke', '#2d2d4e')
                    .attr('stroke-width', 1.5)
                    .attr('stroke-opacity', 0.7)
                    .on('click', (event, d) => {
                        event.stopPropagation();
                        this.ngZone.run(() => this.onLinkClick?.(d));
                    }),
                update => update,
                exit => exit.remove()
            );

        this.g.select('.link-labels')
            .selectAll<SVGTextElement, D3Link>('text')
            .data(this.state.d3Links, d => d.id)
            .join(
                enter => enter.append('text')
                    .attr('class', 'link-label')
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#4b5563')
                    .attr('font-size', '10px')
                    .attr('pointer-events', 'none')
                    .text(d => d.length),
                update => update.text(d => d.length),
                exit => exit.remove()
            );

        const linkForce = this.simulation?.force<d3.ForceLink<D3Node, D3Link>>('link');
        linkForce?.links(this.state.d3Links);
        this.updateLinkStyles();
    }

    addNodeToGraph(node: D3Node) {
        const nodeContainer = this.g.select('.nodes');
        const g = nodeContainer.append('g')
            .datum(node)
            .attr('class', 'graph-node')
            .attr('cursor', 'pointer')
            .attr('transform', `translate(${ node.x ?? 0 }, ${ node.y ?? 0 })`)
            .call(d3.drag<SVGGElement, D3Node>()
                .on('start', (e, d) => this.dragStarted(e, d))
                .on('drag', (e, d) => this.dragged(e, d))
                .on('end', (e, d) => this.dragEnded(e, d))
            )
            .on('click', (event, d) => {
                event.stopPropagation();
                this.ngZone.run(() => this.onNodeClick?.(d));
            });

        g.append('circle').attr('class', 'node-glow').attr('r', 30)
            .attr('fill', 'transparent').attr('stroke', 'transparent').attr('stroke-width', 10);
        g.append('circle').attr('class', 'node-circle').attr('r', 22)
            .attr('fill', '#0f0f23').attr('stroke', '#3b3b6b').attr('stroke-width', 2);
        g.append('text').attr('class', 'node-icon')
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
            .attr('font-size', '15px')
            .text(this.state.houseCategories[node.category]?.icon ?? '📍');
        g.append('text').attr('class', 'node-label')
            .attr('text-anchor', 'middle').attr('y', 35)
            .attr('fill', '#6b7280').attr('font-size', '9px')
            .text(this.state.houseCategories[node.category]?.name ?? '');
    }

    removeNodeFromGraph(id: string) {
        this.g.selectAll<SVGGElement, D3Node>('.graph-node')
            .filter(d => d.id === id).remove();
    }

    updateNodeIcon(id: string, categoryId: number) {
        this.g.selectAll<SVGGElement, D3Node>('.graph-node')
            .filter(d => d.id === id)
            .select('.node-icon')
            .text(this.state.houseCategories[categoryId]?.icon ?? '📍');
        this.g.selectAll<SVGGElement, D3Node>('.graph-node')
            .filter(d => d.id === id)
            .select('.node-label')
            .text(this.state.houseCategories[categoryId]?.name ?? '');
    }

    // ─── Tick ─────────────────────────────────────────────────────────────────

    private ticked() {
        if (!this.g) return;

        this.g.selectAll<SVGLineElement, D3Link>('.graph-link')
            .attr('x1', d => (d.source as D3Node).x ?? 0)
            .attr('y1', d => (d.source as D3Node).y ?? 0)
            .attr('x2', d => (d.target as D3Node).x ?? 0)
            .attr('y2', d => (d.target as D3Node).y ?? 0);

        this.g.selectAll<SVGTextElement, D3Link>('.link-label')
            .attr('x', d => (((d.source as D3Node).x ?? 0) + ((d.target as D3Node).x ?? 0)) / 2)
            .attr('y', d => (((d.source as D3Node).y ?? 0) + ((d.target as D3Node).y ?? 0)) / 2 - 7);

        this.g.selectAll<SVGGElement, D3Node>('.graph-node')
            .attr('transform', d => `translate(${ d.x ?? 0 }, ${ d.y ?? 0 })`);
    }

    private fitGraph() {
        if (!this.g || !this.svg || this.state.d3Nodes.length === 0) return;
        const padding = 80;
        const xs = this.state.d3Nodes.map(d => d.x ?? 0);
        const ys = this.state.d3Nodes.map(d => d.y ?? 0);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        const graphW = maxX - minX || 1;
        const graphH = maxY - minY || 1;
        const scale = Math.min(
            (this.width - padding * 2) / graphW,
            (this.height - padding * 2) / graphH,
            2
        );
        const tx = (this.width - graphW * scale) / 2 - minX * scale;
        const ty = (this.height - graphH * scale) / 2 - minY * scale;
        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        this.svg.transition().duration(600).call(this.zoomBehavior.transform, transform);
        this.g.transition().duration(600).attr('transform', transform.toString());
    }

    // ─── Drag ─────────────────────────────────────────────────────────────────

    private dragStarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
        if (!event.active) this.simulation.alphaTarget(0.15).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    private dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
        d.fx = event.x;
        d.fy = event.y;
    }

    private dragEnded(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>, d: D3Node) {
        if (!event.active) this.simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }

    // ─── Styles ───────────────────────────────────────────────────────────────

    updateNodeStyles() {
        if (!this.g) return;

        this.g.selectAll<SVGGElement, D3Node>('.graph-node').each((d, i, nodes) => {
            const node = d3.select(nodes[i]);
            const isSelected = d.id === this.state.selectedHouse()?.id;
            const isEdgeSource = d.id === this.state.edgeSourceNode()?.id;
            const routeIndex = this.state.routeMainPoints().indexOf(d.id);
            const outerIndex = this.state.routeOuterPoints().indexOf(d.id);
            const inRoute = routeIndex >= 0;
            const isOuter = outerIndex >= 0;
            const hue = inRoute ? (routeIndex * 360) / Math.max(this.state.routeMainPoints().length, 1) : 0;

            if (this.state.pairRoutes() === null) {
                node.select('.node-circle')
                    .attr('fill',
                        isSelected ? '#4c1d95' :
                            isEdgeSource ? '#064e3b' :
                                inRoute ? `hsl(${ hue }, 60%, 18%)` :
                                    isOuter ? '#282830' : '#0f0f23'
                    )
                    .attr('stroke',
                        isSelected ? '#8b5cf6' :
                            isEdgeSource ? '#10b981' :
                                inRoute ? `hsl(${ hue }, 70%, 55%)` :
                                    isOuter ? '#6e6e70' : '#3b3b6b'
                    )

                node.select('.node-glow')
                    .attr('stroke',
                        isSelected ? '#8b5cf6' :
                            isEdgeSource ? '#10b981' :
                                inRoute ? `hsl(${ hue }, 70%, 55%)` : 'transparent'
                    )

                if (inRoute)
                    node.append('text')
                        .attr('fill', `hsl(${ hue }, 70%, 70%)`)
                        .text(routeIndex + 1);
            } else {
                const firstRouteMainPoints = this.state.pairRoutes()!.first.points.filter(p => p.role === 'main').map(p => p.id);
                const secondRouteMainPoints = this.state.pairRoutes()!.second.points.filter(p => p.role === 'main').map(p => p.id);
                const firstIndex = firstRouteMainPoints.indexOf(d.id);
                const secondIndex = secondRouteMainPoints.indexOf(d.id);
                const isInFirst = firstIndex >= 0;
                const isInSecond = secondIndex >= 0;

                node.select('.node-circle')
                    .attr('fill',
                        isSelected ? '#4c1d95' :
                            isEdgeSource ? '#064e3b' :
                                isInSecond && isInFirst ? this.getPointColor('both', 'bg') :
                                    isInFirst ? this.getPointColor('first', 'bg') :
                                        isInSecond ? this.getPointColor('second', 'bg') :
                                            isOuter ? `#282830` : '#0f0f23'
                    )
                    .attr('stroke',
                        isSelected ? '#8b5cf6' :
                            isEdgeSource ? '#10b981' :
                                isInSecond && isInFirst ? this.getPointColor('both', 'border') :
                                    isInFirst ? this.getPointColor('first', 'border') :
                                        isInSecond ? this.getPointColor('second', 'border') :
                                            isOuter ? '#6e6e70' : '#3b3b6b'
                    )

                node.select('.node-glow')
                    .attr('stroke',
                        isSelected ? '#8b5cf6' :
                            isEdgeSource ? '#10b981' :
                                isInSecond && isInFirst ? this.getPointColor('both', 'border') :
                                    isInFirst ? this.getPointColor('first', 'border') :
                                        isInSecond ? this.getPointColor('second', 'border') : 'transparent'
                    )

                if (inRoute)
                    console.log(firstIndex, secondIndex);
                if (inRoute)
                    node.append('text')
                        .attr('fill',
                            isInSecond && isInFirst ? this.getPointColor('both', "text") :
                                isInFirst ? this.getPointColor('first', 'text') :
                                    this.getPointColor('second', 'text')
                        )
                        .text(Math.max(firstIndex, secondIndex));
            }

            node.select('.node-circle')
                .transition().duration(200)
                .attr('stroke-width', isSelected || isEdgeSource || inRoute ? 2.5 : 2)
                .attr('r', isSelected || isEdgeSource ? 26 : 22);

            node.select('.node-glow')
                .transition().duration(200)
                .attr('stroke-opacity', isSelected || isEdgeSource || inRoute ? 0.35 : 0);

            node.select('.route-index').remove();

            if (inRoute) {
                node.append('text')
                    .attr('class', 'route-index')
                    .attr('text-anchor', 'middle')
                    .attr('y', -30)
                    .attr('font-size', '10px')
                    .attr('font-weight', '700')
            }
        });
    }

    updateLinkStyles() {
        if (!this.g) return;

        this.g.selectAll<SVGLineElement, D3Link>('.graph-link').each((d, i, nodes) => {
            const link = d3.select(nodes[i]);
            const src = (d.source as D3Node).id;
            const tgt = (d.target as D3Node).id;
            const isSelected = d.id === this.state.selectedStreet()?.id;

            if (this.state.pairRoutes() === null) {
                let segIdx = -1;
                const routeResult = this.state.routeResult();
                for (let j = 0; j < routeResult.length - 1; j++) {
                    const a = routeResult[j].id, b = routeResult[j + 1].id;
                    if ((src === a && tgt === b) || (src === b && tgt === a)) {
                        let l = j;
                        while (routeResult[l].role !== 'main') l--;
                        const mainPoints = this.state.routeMainPoints();
                        for (let k = 0; k < mainPoints.length - 1; k++) {
                            if (mainPoints[k] === routeResult[l].id) {
                                segIdx = k;
                                break;
                            }
                        }
                        break;
                    }
                }

                const inRoute = segIdx >= 0;
                const hue = inRoute ? (segIdx * 360) / Math.max(this.state.routeMainPoints().length, 1) : 0;

                link.transition().duration(200)
                    .attr('stroke',
                        isSelected ? '#f59e0b' :
                            inRoute ? `hsl(${ hue }, 70%, 55%)` : '#2d2d4e'
                    )
                    // .attr('stroke-width', isSelected ? 4 : inRoute ? 3 : 1.5)
                    .attr('stroke-opacity', isSelected ? 1 : inRoute ? 1 : 0.7);
            } else {
                let isInFirst = false;
                let isInSecond = false;

                let route = this.state.pairRoutes()?.first.points!;
                for (let j = 0; j < route.length - 1; j++) {
                    const a = route[j].id, b = route[j + 1].id;
                    if ((src === a && tgt === b) || (src === b && tgt === a)) {
                        isInFirst = true;
                        break;
                    }
                }

                route = this.state.pairRoutes()?.second.points!;
                for (let j = 0; j < route.length - 1; j++) {
                    const a = route[j].id, b = route[j + 1].id;
                    if ((src === a && tgt === b) || (src === b && tgt === a)) {
                        isInSecond = true;
                        break;
                    }
                }

                link.transition().duration(200)
                    .attr('stroke',
                        isSelected ? '#f59e0b' :
                            isInFirst && isInSecond ? this.getPointColor('both', 'border') :
                                isInFirst ? this.getPointColor('first', 'border') :
                                    isInSecond ? this.getPointColor('second', 'border') : `#2d2d4e`
                    )
                    .attr('stroke-opacity', isSelected ? 1 : isInSecond || isInSecond ? 1 : 0.7);
            }
        });
    }

    getPointColor(presence: 'both' | 'first' | 'second' | 'none', part: 'bg' | 'border' | 'text'): string {
        const colors = {
            both: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', text: '#22c55e' },
            first: { bg: 'rgba(61,142,240,0.15)', border: 'rgba(61,142,240,0.4)', text: '#3d8ef0' },
            second: { bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)', text: '#f59e0b' },
            none: { bg: 'rgba(99,140,200,0.08)', border: 'rgba(99,140,200,0.2)', text: '#8a9ab8' },
        };
        return colors[presence][part];
    }
}