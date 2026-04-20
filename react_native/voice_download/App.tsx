import React, { useEffect, useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Platform,
	StatusBar,
	TouchableOpacity,
	ScrollView,
	Alert,
	Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
	GemKitPlatform,
	SdkSettings,
	ContentStore,
	ContentType,
	ContentStoreItem,
	GemError,
	ContentStoreItemStatus,
	IGemKitPlatform,
	ServiceGroupType,
	MapDetails,
} from '@magiclane/maps-sdk';
import { GemKitNativeReact } from '@magiclane/maps-sdk-react-native';
import { GLView } from '@magiclane/maps-sdk-react-native';


export class MagicLaneHelper{
  static convertUint8ArrayToBase64(uint8Array: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(uint8Array);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = global.btoa ? global.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
    return base64;
  }
}

interface VoiceItemProps {
	voiceItem: ContentStoreItem;
	onUpdate: () => void;
}

const VoiceItem: React.FC<VoiceItemProps> = ({ voiceItem, onUpdate }) => {
	const [progress, setProgress] = useState(voiceItem.downloadProgress);
	const [isDownloaded, setIsDownloaded] = useState(voiceItem.isCompleted);

	useEffect(() => {
		setProgress(voiceItem.downloadProgress);
		setIsDownloaded(voiceItem.isCompleted);
	}, [voiceItem.downloadProgress, voiceItem.isCompleted]);

	useEffect(() => {
		if (isDownloadingOrWaiting(voiceItem)) {
			pauseAndRestartDownload(voiceItem);
		}
	}, []);

	const isDownloadingOrWaiting = (item: ContentStoreItem) => {
		return item.downloadProgress > 0 && item.downloadProgress < 100 && !item.isCompleted;
	};

	const pauseAndRestartDownload = async (item: ContentStoreItem) => {
		const err = await item.pauseDownload(() => {
			downloadVoice(item);
		});
		if (err !== GemError.success) {
			console.log(`Download pause failed with code ${err}`);
		}
	};

	const downloadVoice = (item: ContentStoreItem) => {
		console.log(`Starting download for ${item.name}`);
		item.asyncDownload(
			(err: GemError) => {
				console.log(`Download callback for ${item.name}, err: ${err}`);
				if (err === GemError.success) {
					setIsDownloaded(true);
					onUpdate();
				}
			},
			{
				onProgressCallback: (prog: number) => {
					console.log(`Progress for ${item.name}: ${prog}%`);
					setProgress(prog);
				},
				allowChargedNetworks: true,
			}
		);
	};

	const handleTileTap = () => {
		if (isDownloaded) return;

		if (isDownloadingOrWaiting(voiceItem)) {
			voiceItem.pauseDownload(() => {
				onUpdate();
			});
		} else {
			downloadVoice(voiceItem);
		}
	};

	const handleDelete = () => {
		Alert.alert('Delete Voice', `Are you sure you want to delete ${voiceItem.name}?`, [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: () => {
					if (voiceItem.deleteContent() === GemError.success) {
						setIsDownloaded(false);
						setProgress(0);
						onUpdate();
					}
				},
			},
		]);
	};

	const getCountryFlag = () => {
		const countryCodes = voiceItem.countryCodes;
		if (countryCodes && countryCodes.length > 0) {
			const flagImg = MapDetails.getCountryFlag(countryCodes[0], { width: 80, height: 80 });
			if (!flagImg) return null;
			const base64 = MagicLaneHelper.convertUint8ArrayToBase64(flagImg);
			return `data:image/png;base64,${base64}`;
		}
		return null;
	};

	const renderStatusIcon = () => {
		if (isDownloaded) {
			return <Text style={styles.iconCompleted}>OK</Text>;
		}
		if (progress > 0 && progress < 100) {
			return (
				<View style={styles.progressContainer}>
					<Text style={styles.progressText}>{Math.round(progress)}%</Text>
				</View>
			);
		}
		if (voiceItem.status === ContentStoreItemStatus.paused) {
			return <Text style={styles.iconPaused}>||</Text>;
		}
		return <Text style={styles.iconDownload}>DL</Text>;
	};

	const sizeMB = (voiceItem.totalSize / (1024 * 1024)).toFixed(2);
	const flagUri = getCountryFlag();

	const language = voiceItem.contentParameters?.at(3)?.value || '';
	const gender = voiceItem.contentParameters?.at(1)?.value || '';

	return (
		<View style={styles.voiceItem}>
			<TouchableOpacity style={styles.voiceItemContent} onPress={handleTileTap}>
				{flagUri && (
					<View style={styles.flagContainer}>
						<Image source={{ uri: flagUri }} style={styles.flagImage} resizeMode="contain" />
					</View>
				)}
				<View style={styles.voiceItemInfo}>
					<Text style={styles.voiceItemTitle}>
						{voiceItem.name} ({sizeMB} MB)
					</Text>
					<Text style={styles.voiceItemSubtitle}>
						{language} - {gender}
					</Text>
				</View>
				<View style={styles.voiceItemStatus}>{renderStatusIcon()}</View>
			</TouchableOpacity>
			{isDownloaded && (
				<TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
					<Text style={styles.deleteButtonText}>DEL</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

export default function VoiceDownloadDemo() {
	const [initialized, setInitialized] = useState(false);
	const [initError, setInitError] = useState<string | null>(null);
	const [gemMap, setGemMap] = useState<any>(null);
	const [voices, setVoices] = useState<ContentStoreItem[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		let gemKitInstance;
		if (IGemKitPlatform.getInstance() == null) {
			gemKitInstance = new GemKitNativeReact();
			GemKitPlatform.getInstance(gemKitInstance);
		} else {
			gemKitInstance = IGemKitPlatform.getInstance();
		}

		const init = async () => {
			try {
				GemKitPlatform.getInstance().loadNative();
				SdkSettings.appAuthorization = "";
        SdkSettings.offBoardListener.registerOnConnectionStatusUpdated((status) => {
          console.log('Connection status updated:', status);
        });
				SdkSettings.setAllowOffboardServiceOnExtraChargedNetwork(
					ServiceGroupType.ContentService,
					true
				);

				if (!mounted) return;
				setInitialized(true);

				await loadVoices();
			} catch (e: any) {
				setInitError(String(e?.message || e));
			}
		};

		if (Platform.OS === 'android') {
			setTimeout(init, 2000);
		} else {
			init();
		}

		return () => {
			mounted = false;
		};
	}, []);

	const loadVoices = async () => {
		try {
			setLoading(true);
			ContentStore.asyncGetStoreContentList(
				ContentType.humanVoice,
				(err: GemError, items: ContentStoreItem[] | null) => {
					if (err === GemError.success && items) {
						setVoices(items);
					} else {
						console.error('Failed to load voices:', err);
						Alert.alert('Error', 'Failed to load voices list');
					}
					setLoading(false);
				}
			);
		} catch (e) {
			console.error('Error loading voices:', e);
			setLoading(false);
		}
	};

	const handleVoiceUpdate = () => {
		loadVoices();
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar barStyle="light-content" backgroundColor="#4a148c" />
			<View style={styles.container}>
				<GLView
					style={{ flex: 1, backgroundColor: '#e8e8e8' }}
					onMapReady={(event) => {
						if (event.gemMap) {
							setGemMap(event.gemMap);
						}
					}}
				/>
				<View style={styles.overlay}>
					<View style={styles.header}>
						<Text style={styles.headerTitle}>Voice Download</Text>
						<TouchableOpacity style={styles.refreshButton} onPress={loadVoices}>
							<Text style={styles.refreshButtonText}>R</Text>
						</TouchableOpacity>
					</View>

					{!initialized && !initError && <Text style={styles.info}>Initializing...</Text>}
					{initError && <Text style={styles.error}>Init failed: {initError}</Text>}

					{loading ? (
						<Text style={styles.info}>Loading voices...</Text>
					) : (
						<ScrollView style={styles.voicesList} showsVerticalScrollIndicator={false}>
							{voices.length === 0 ? (
								<Text style={styles.emptyText}>No voices available</Text>
							) : (
								voices.map((voiceItem, index) => (
									<VoiceItem
										key={`${voiceItem.id}-${index}`}
										voiceItem={voiceItem}
										onUpdate={handleVoiceUpdate}
									/>
								))
							)}
						</ScrollView>
					)}
				</View>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#4a148c',
	},
	container: {
		flex: 1,
		backgroundColor: '#f0f0f0',
	},
	overlay: {
		position: 'absolute',
		top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 20,
		left: 12,
		right: 12,
		bottom: 20,
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 16,
		shadowColor: '#000',
		shadowOpacity: 0.15,
		shadowRadius: 8,
		elevation: 5,
		zIndex: 1000,
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
		paddingBottom: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#e0e0e0',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: '#333',
	},
	refreshButton: {
		padding: 4,
	},
	refreshButtonText: {
		fontSize: 24,
		color: '#4a148c',
	},
	info: {
		color: '#666',
		marginBottom: 8,
		textAlign: 'center',
		fontSize: 14,
	},
	error: {
		color: '#e74c3c',
		marginBottom: 8,
		textAlign: 'center',
		fontSize: 14,
	},
	emptyText: {
		textAlign: 'center',
		color: '#999',
		fontSize: 14,
		marginTop: 20,
	},
	voicesList: {
		flex: 1,
	},
	voiceItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f0f0',
	},
	voiceItemContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
	},
	flagContainer: {
		width: 50,
		height: 50,
		marginRight: 12,
		justifyContent: 'center',
		alignItems: 'center',
	},
	flagImage: {
		width: 40,
		height: 40,
	},
	voiceItemInfo: {
		flex: 1,
	},
	voiceItemTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333',
		marginBottom: 4,
	},
	voiceItemSubtitle: {
		fontSize: 14,
		color: '#666',
	},
	voiceItemStatus: {
		width: 60,
		alignItems: 'center',
		justifyContent: 'center',
	},
	iconCompleted: {
		fontSize: 20,
		color: '#4caf50',
	},
	iconPaused: {
		fontSize: 20,
		color: '#ff9800',
	},
	iconDownload: {
		fontSize: 20,
		color: '#666',
	},
	progressContainer: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#e8eaf6',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: '#4a148c',
	},
	progressText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#4a148c',
	},
	deleteButton: {
		padding: 8,
		marginLeft: 8,
	},
	deleteButtonText: {
		fontSize: 16,
	},
});
