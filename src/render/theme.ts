import type { FlavorId } from '../core/types';

export interface FlavorStyle {
  name: string;
  base: string;
  dark: string;
  light: string;
}

export const FLAVORS: Record<FlavorId, FlavorStyle> = {
  strawberry: { name: '草莓', base: '#FF9DB5', dark: '#E87896', light: '#FFC6D5' },
  mango: { name: '芒果', base: '#FFC46B', dark: '#E8A445', light: '#FFDCA4' },
  cocoa: { name: '可可', base: '#B98A65', dark: '#9A6C48', light: '#D3AC8D' },
  matcha: { name: '抹茶', base: '#9FD58F', dark: '#7CB86A', light: '#C4E6B8' },
  blueberry: { name: '蓝莓', base: '#8FA8E8', dark: '#6B85CC', light: '#B9CAF2' },
  vanilla: { name: '香草', base: '#F2DFAF', dark: '#D8BF85', light: '#F8ECCB' },
  caramel: { name: '焦糖', base: '#E0A05C', dark: '#C4823E', light: '#F0C08C' },
  cherry: { name: '樱桃', base: '#E86A7A', dark: '#CC4E5F', light: '#F49AA6' },
  lemon: { name: '柠檬', base: '#F3E06E', dark: '#D8C34C', light: '#F8EDA2' },
  taro: { name: '紫薯', base: '#B79BD8', dark: '#9777C0', light: '#D3C0EA' },
  peach: { name: '蜜桃', base: '#FFB59B', dark: '#E89474', light: '#FFD0BE' },
};

export const theme = {
  colors: {
    bgTop: '#FFF8F0',
    bgBottom: '#FFEEDF',
    text: '#7A5C46',
    textLight: '#A98A72',
    primary: '#FF9DB5',
    primaryDark: '#E87896',
    panel: '#FFFDF9',
    panelBorder: '#F0DCC8',
    highlight: '#FFB020',
    locked: '#D9C9BA',
    danger: '#D9534F',
    success: '#7CB86A',
  },
  font: '"PingFang SC", "Microsoft YaHei", sans-serif',
  fontSize: {
    title: 56,
    heading: 40,
    body: 28,
    small: 22,
  },
  radius: {
    bowl: 18,
    button: 24,
    panel: 24,
    layer: 8,
  },
  spacing: {
    xxs: 8,
    xs: 12,
    sm: 16,
    md: 24,
  },
};
