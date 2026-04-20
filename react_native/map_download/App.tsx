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
} from '@magiclane/maps-sdk';
import { GemKitNativeReact, GLView } from '@magiclane/maps-sdk-react-native';
//import { AUTH_TOKEN } from './auth_token';

interface MapItemProps {
	mapItem: ContentStoreItem;
	onUpdate: () => void;
}

const MapItem: React.FC<MapItemProps> = ({ mapItem, onUpdate }) => {
	const [progress, setProgress] = useState(mapItem.downloadProgress);
	const [status, setStatus] = useState(mapItem.status);
	const [isDownloading, setIsDownloading] = useState(false);

	useEffect(() => {
		setProgress(mapItem.downloadProgress);
		setStatus(mapItem.status);
	}, [mapItem.downloadProgress, mapItem.status]);

	const downloadMap = (item: ContentStoreItem) => {
		if (item.isCompleted) return;
		setIsDownloading(true);
		setStatus(ContentStoreItemStatus.downloading);
		item.asyncDownload(
			(err: GemError) => {
				if (err === GemError.success) {
					setProgress(100);
					setStatus(ContentStoreItemStatus.completed);
					setIsDownloading(false);
					setTimeout(() => onUpdate(), 500);
				} else {
					setStatus(ContentStoreItemStatus.paused);
					setIsDownloading(false);
					console.log(`Download interrupted: ${err}`);
				}
			},
			{
				onProgressCallback: (prog: number) => {
					setProgress(prog);
					setStatus(ContentStoreItemStatus.downloading);
				},
				allowChargedNetworks: true,
			}
		);
	};

	const handlePause = async () => {
		await mapItem.pauseDownload(() => {
			setStatus(mapItem.status);
		});
	};

	const handleTileTap = () => {
		if (mapItem.isCompleted) return;
		if (status === ContentStoreItemStatus.downloading || isDownloading) {
			handlePause();
		} else {
			downloadMap(mapItem);
		}
	};

	const handleDelete = () => {
		Alert.alert('Delete Map', `Are you sure you want to delete ${mapItem.name}?`, [
			{ text: 'Cancel', style: 'cancel' },
			{
				text: 'Delete',
				style: 'destructive',
				onPress: () => {
					mapItem.deleteContent();
					setStatus(ContentStoreItemStatus.unknown);
					setProgress(0);
					onUpdate();
				},
			},
		]);
	};

	const renderStatusIcon = () => {
		console.log(
			`Rendering status icon - status: ${status}, progress: ${progress}, isCompleted: ${mapItem.isCompleted}`
		);
		if (mapItem.isCompleted) {
			return <Text style={styles.iconCompleted}>OK</Text>;
		}
		if (progress > 0 && progress < 100) {
			return (
				<View style={styles.progressContainer}>
					<Text style={styles.progressText}>{Math.round(progress)}%</Text>
				</View>
			);
		}
		if (status === ContentStoreItemStatus.paused) {
			return <Text style={styles.iconPaused}>||</Text>;
		}
		return <Text style={styles.iconPaused}>DL</Text>;
	};

	const sizeMB = (mapItem.totalSize / (1024 * 1024)).toFixed(2);

	return (
		<View style={styles.mapItem}>
			<TouchableOpacity style={styles.mapItemContent} onPress={handleTileTap}>
				<View style={styles.mapItemInfo}>
					<Text style={styles.mapItemTitle}>{mapItem.name}</Text>
					<Text style={styles.mapItemSize}>{sizeMB} MB</Text>
				</View>
				<View style={styles.mapItemStatus}>{renderStatusIcon()}</View>
			</TouchableOpacity>
			{mapItem.isCompleted && (
				<TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
					<Text style={styles.deleteButtonText}>DEL</Text>
				</TouchableOpacity>
			)}
		</View>
	);
};

export default function MapDownloadDemo() {
	const [initialized, setInitialized] = useState(false);
	const [initError, setInitError] = useState<string | null>(null);
	const [gemMap, setGemMap] = useState<any>(null);
	const [status, setStatus] = useState('Initializing...');
	const [maps, setMaps] = useState<ContentStoreItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [showDownloads, setShowDownloads] = useState(false);

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
				SdkSettings.appAuthorization = "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiI3ZGM5MWZhMC02OTYzLTQ0ZTUtODlmOS1jOWRkNjlhZjA0MGEiLCJleHAiOjE3ODA0Nzk1OTMsImlzcyI6Ik1hZ2ljIExhbmUiLCJqdGkiOiI4MzhmNzVmZi0xZjJkLTQxMDgtYjdiMy1iMTU0M2M4ZWFhNWEifQ.LEhrA8PCbvcpj_DSzAmSkSPDaK1bKMM3AFIsGgqSxZaENQQTsVlcqr4T7lvksckxbmSGZXE5NYAqm9lKOtMwIQ";
				SdkSettings.offBoardListener.registerOnConnectionStatusUpdated(
					async (isConnected: boolean) => {
						await loadMaps();
					}
				);
				SdkSettings.setAllowOffboardServiceOnExtraChargedNetwork(
					ServiceGroupType.ContentService,
					true
				);
				SdkSettings.setAllowInternetConnection(true);

				if (!mounted) return;
				setInitialized(true);
				setStatus('SDK initialized');
			} catch (e: any) {
				setInitError(String(e?.message || e));
				setStatus('Initialization failed');
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

	const loadMaps = async () => {
		try {
			setLoading(true);
			ContentStore.asyncGetStoreContentList(
				ContentType.roadMap,
				(err: GemError, items: ContentStoreItem[] | null) => {
					if (err === GemError.success && items) {
						setMaps(items);
					} else {
						console.error('Failed to load maps:', err);
						Alert.alert('Error', 'Failed to load maps list');
					}
					setLoading(false);
				}
			);
		} catch (e) {
			console.error('Error loading maps:', e);
			setLoading(false);
		}
	};

	const handleMapUpdate = () => {
		loadMaps();
	};

	return (
		<SafeAreaView style={styles.safeArea}>
			<StatusBar barStyle="light-content" backgroundColor="#000" />
			<View style={styles.container}>
				<GLView
					style={{ flex: 1, backgroundColor: '#e8e8e8' }}
					onMapReady={(event) => {
						if (event.gemMap) {
							setGemMap(event.gemMap);
							setStatus('Map Ready');
						}
					}}
				/>
				<TouchableOpacity
					style={styles.toggleButton}
					onPress={() => {
						setShowDownloads((prev) => {
							const next = !prev;
							if (next) {
								loadMaps();
							}
							return next;
						});
					}}
				>
					<Text style={styles.toggleButtonText}>
						{showDownloads ? 'Hide Downloads' : 'Show Downloads'}
					</Text>
				</TouchableOpacity>
				{showDownloads && (
					<View style={styles.overlay}>
					<View style={styles.header}>
						<Text style={styles.headerTitle}>Map Download</Text>
						<TouchableOpacity style={styles.refreshButton} onPress={loadMaps}>
							<Text style={styles.refreshButtonText}>R</Text>
						</TouchableOpacity>
					</View>

					{!initialized && !initError && <Text style={styles.info}>Initializing...</Text>}
					{initError && <Text style={styles.error}>Init failed: {initError}</Text>}

					{loading ? (
						<Text style={styles.info}>Loading maps...</Text>
					) : (
						<ScrollView style={styles.mapsList} showsVerticalScrollIndicator={false}>
							{maps.length === 0 ? (
								<Text style={styles.emptyText}>No maps available</Text>
							) : (
								maps.map((mapItem, index) => (
									<MapItem
										key={`${mapItem.id}-${index}`}
										mapItem={mapItem}
										onUpdate={handleMapUpdate}
									/>
								))
							)}
						</ScrollView>
					)}
					</View>
				)}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: '#000',
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
	toggleButton: {
		position: 'absolute',
		top: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 20,
		right: 12,
		backgroundColor: '#111',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 18,
		zIndex: 1100,
	},
	toggleButtonText: {
		color: '#fff',
		fontSize: 12,
		fontWeight: '600',
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
		color: '#6200ee',
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
	mapsList: {
		flex: 1,
	},
	mapItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#f0f0f0',
	},
	mapItemContent: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	mapItemInfo: {
		flex: 1,
	},
	mapItemTitle: {
		fontSize: 16,
		fontWeight: '600',
		color: '#333',
		marginBottom: 4,
	},
	mapItemSize: {
		fontSize: 14,
		color: '#666',
	},
	mapItemStatus: {
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
	progressContainer: {
		width: 50,
		height: 50,
		borderRadius: 25,
		backgroundColor: '#e3f2fd',
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 2,
		borderColor: '#2196f3',
	},
	progressText: {
		fontSize: 12,
		fontWeight: '600',
		color: '#2196f3',
	},
	deleteButton: {
		padding: 8,
		marginLeft: 8,
	},
	deleteButtonText: {
		fontSize: 16,
	},
});
