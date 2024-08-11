import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';

interface MultilineInputProps {
	onSubmit: (value: string) => void;
	history: string[];
	saveHistory: (value: string) => void;
}

const MultilineInput: React.FC<MultilineInputProps> = ({ onSubmit, history, saveHistory }) => {
	//	const [value, setValue] = useState('');
	// 	const [suggestions, setSuggestions] = useState<string[]>([]);
	// 	const [showSuggestions, setShowSuggestions] = useState(false);

	const { exit } = useApp();

	useInput((input, key) => {
		if (input === 'q') {
			exit();
		}
	});

	return (
		<Box flexDirection='column'>
			<Text>Use arrow keys to move the face. Press “q” to exit.</Text>
			<Box height={12} paddingLeft={x} paddingTop={y}>
				<Text>^_^</Text>
			</Box>
		</Box>
	);
};
/*
const MultilineInput: React.FC<MultilineInputProps> = ({ onSubmit, history, saveHistory }) => {
	const [value, setValue] = useState('');
// 	const [suggestions, setSuggestions] = useState<string[]>([]);
// 	const [showSuggestions, setShowSuggestions] = useState(false);

	const handleChange = (input: string) => {
// 		setValue(input);
// 		const matchingSuggestions = history.filter((h) => h.toLowerCase().includes(input.toLowerCase()));
// 		setSuggestions(matchingSuggestions);
// 		setShowSuggestions(matchingSuggestions.length > 0);
	};

	const handleSubmit = () => {
		if (value && !history.includes(value)) {
			saveHistory(value);
		}
		onSubmit(value);
	};

	const handleSelect = (item: { value: string }) => {
		setValue(item.value);
		setShowSuggestions(false);
	};

	return (
		<Box flexDirection='column'>
			<Text>Ask Claude (Ctrl+D to finish):</Text>
			<TextInput
				value={value}
				onChange={handleChange}
				onSubmit={handleSubmit}
			/>
			{showSuggestions && (
				<SelectInput
					items={suggestions.map((s) => ({ label: s, value: s }))}
					onSelect={handleSelect}
				/>
			)}
		</Box>
	);
};
 */

export default MultilineInput;
