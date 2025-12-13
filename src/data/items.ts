export interface ItemData {
    id: string;
    name: string;
    type: 'consumable' | 'equipment' | 'key';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    effect?: (target: any) => void;
    price: number;
}

export const Items: Record<string, ItemData> = {
    potion: {
        id: 'potion',
        name: 'Potion',
        type: 'consumable',
        price: 50
    }
};
