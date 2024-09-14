import { type Config } from 'npm:tailwindcss@3.3.5';

export default {
	content: [
		'{routes,islands,components}/**/*.{ts,tsx}',
	],
	theme: {
		extend: {
			fontSize: {
				'xs': '0.6rem',
				'sm': '0.7rem',
				'base': '0.8rem',
				'lg': '0.9rem',
				'xl': '1rem',
				'2xl': '1.15rem',
				'3xl': '1.35rem',
				'4xl': '1.6rem',
				'5xl': '1.85rem',
			},
		},
	},
	plugins: [],
} satisfies Config;
