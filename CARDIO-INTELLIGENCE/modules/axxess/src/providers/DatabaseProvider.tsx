/**
 * MedScribe — Database Provider
 * Initializes DB and seeds demo data on app start.
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getDatabase } from '@/src/modules/db/schema';
import { seedDemoData } from '@/src/modules/db/axxess__modules_db__queries';

interface DatabaseContextValue {
    isReady: boolean;
    refreshKey: number;
    refresh: () => void;
}

const DatabaseContext = createContext<DatabaseContextValue>({
    isReady: false,
    refreshKey: 0,
    refresh: () => { },
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                await getDatabase();
                await seedDemoData();
                setIsReady(true);
            } catch (error) {
                console.error('Database initialization failed:', error);
                setIsReady(true); // Still render app, will show empty states
            }
        })();
    }, []);

    const refresh = () => setRefreshKey((k) => k + 1);

    return (
        <DatabaseContext.Provider value={{ isReady, refreshKey, refresh }}>
            {children}
        </DatabaseContext.Provider>
    );
}

export function useDatabase() {
    return useContext(DatabaseContext);
}
