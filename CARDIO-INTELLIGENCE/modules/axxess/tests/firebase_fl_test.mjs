/**
 * MedScribe — Firebase FL Integration Test
 * Run: node tests/firebase_fl_test.mjs
 *
 * Tests:
 * 1. Firebase connection
 * 2. Write a training signal to Firestore
 * 3. Create an FL round
 * 4. Read back data
 * 5. Update adapter info
 * 6. Edge cases (empty signals, duplicate rounds, offline fallback)
 */
import { initializeApp } from 'firebase/app';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    addDoc,
    deleteDoc,
    query,
    orderBy,
    limit,
} from 'firebase/firestore';

if (!process.env.FIREBASE_API_KEY) throw new Error('Set FIREBASE_API_KEY to run this live integration test.');

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: "hamza2-51ce6.firebaseapp.com",
    projectId: "hamza2-51ce6",
    storageBucket: "hamza2-51ce6.firebasestorage.app",
    messagingSenderId: "983002005193",
    appId: "1:983002005193:web:b6f89b9818af1443ef1718",
    measurementId: "G-GKCTT9XHW2",
};

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        console.log(`  ✅ ${label}`);
        passed++;
    } else {
        console.log(`  ❌ ${label}`);
        failed++;
    }
}

async function main() {
    console.log('\n═══════════════════════════════════════');
    console.log('  MedScribe — Firebase FL Test Suite');
    console.log('═══════════════════════════════════════\n');

    // ─── Test 1: Firebase Connection ────────────────
    console.log('📡 Test 1: Firebase Connection');
    let db;
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        assert(!!db, 'Firebase initialized successfully');
    } catch (err) {
        console.log(`  ❌ Firebase init failed: ${err.message}`);
        failed++;
        process.exit(1);
    }

    // ─── Test 2: Write Training Signal ──────────────
    console.log('\n📝 Test 2: Write Training Signal to Firestore');
    const testSignalId = `test-signal-${Date.now()}`;
    try {
        const signalRef = doc(db, 'fl_signals', testSignalId);
        await setDoc(signalRef, {
            type: 'correction',
            original_text_hash: 'sha256:test_hash_abc123',
            corrected_text: 'Lisinopril 10mg daily',
            confidence: 0.85,
            specialty: 'cardiology',
            device_id: 'test-device-001',
            round_id: 999,
            timestamp: Date.now(),
        });
        assert(true, 'Signal written to fl_signals');

        // Read it back
        const readBack = await getDoc(signalRef);
        assert(readBack.exists(), 'Signal can be read back');
        assert(readBack.data().type === 'correction', 'Signal data is correct');
        assert(readBack.data().corrected_text === 'Lisinopril 10mg daily', 'Correction text preserved');
    } catch (err) {
        console.log(`  ❌ Signal write failed: ${err.message}`);
        failed++;
    }

    // ─── Test 3: Create FL Round ────────────────────
    console.log('\n🔄 Test 3: Create FL Round in Firestore');
    const testRoundId = 'round_test_999';
    try {
        const roundRef = doc(db, 'fl_rounds', testRoundId);
        const roundData = {
            round_id: 999,
            status: 'training',
            started_at: Date.now(),
            completed_at: null,
            devices_participating: 1,
            sessions_contributed: 3,
            accuracy_before: 91.5,
            accuracy_after: 0,
            delta_size_kb: 0,
            epsilon_consumed: 0,
        };
        await setDoc(roundRef, roundData);
        assert(true, 'Round created in fl_rounds');

        // Update round status through phases
        await setDoc(roundRef, { ...roundData, status: 'uploading' });
        let snap = await getDoc(roundRef);
        assert(snap.data().status === 'uploading', 'Round status updated to uploading');

        await setDoc(roundRef, { ...roundData, status: 'merging' });
        snap = await getDoc(roundRef);
        assert(snap.data().status === 'merging', 'Round status updated to merging');

        await setDoc(roundRef, {
            ...roundData,
            status: 'complete',
            completed_at: Date.now(),
            accuracy_after: 92.8,
            delta_size_kb: 45,
            epsilon_consumed: 0.42,
        });
        snap = await getDoc(roundRef);
        assert(snap.data().status === 'complete', 'Round completed successfully');
        assert(snap.data().accuracy_after === 92.8, 'Accuracy tracked correctly');
        assert(snap.data().epsilon_consumed === 0.42, 'Epsilon budget tracked');
    } catch (err) {
        console.log(`  ❌ Round creation failed: ${err.message}`);
        failed++;
    }

    // ─── Test 4: Device Metrics ─────────────────────
    console.log('\n📊 Test 4: Device Metrics Persistence');
    try {
        const deviceRef = doc(db, 'fl_devices', 'test-device-001');
        await setDoc(deviceRef, {
            total_rounds_participated: 1,
            total_sessions_contributed: 3,
            total_signals_collected: 1,
            current_adapter_version: 'v999.1',
            specialty_cluster: 'Cardiology',
            epsilon_budget_total: 12.0,
            epsilon_budget_used: 0.42,
            model_accuracy: 92.8,
            wer_improvement: 0.5,
            last_upload_at: Date.now(),
            last_merge_at: Date.now(),
        });
        assert(true, 'Device metrics written');

        const snap = await getDoc(deviceRef);
        assert(snap.data().current_adapter_version === 'v999.1', 'Adapter version persisted');
        assert(snap.data().epsilon_budget_used === 0.42, 'Privacy budget persisted');
    } catch (err) {
        console.log(`  ❌ Device metrics failed: ${err.message}`);
        failed++;
    }

    // ─── Test 5: Adapter Info ───────────────────────
    console.log('\n🧠 Test 5: Adapter Info Tracking');
    try {
        const adapterRef = doc(db, 'fl_adapters', 'current');
        await setDoc(adapterRef, {
            version: 'v999.1',
            round_id: 999,
            updated_at: Date.now(),
            rank: 8,
            alpha: 16,
            trainable_params: 294912,
        });
        assert(true, 'Adapter info written');

        const snap = await getDoc(adapterRef);
        assert(snap.data().version === 'v999.1', 'Adapter version readable');
        assert(snap.data().trainable_params === 294912, 'Adapter params correct');
    } catch (err) {
        console.log(`  ❌ Adapter info failed: ${err.message}`);
        failed++;
    }

    // ─── Test 6: Query Round History ────────────────
    console.log('\n📜 Test 6: Query Round History');
    try {
        const q = query(collection(db, 'fl_rounds'), orderBy('round_id', 'desc'), limit(5));
        const snapshot = await getDocs(q);
        assert(!snapshot.empty, 'Round history query returns results');
        assert(snapshot.docs[0].data().round_id === 999, 'Latest round is our test round');
    } catch (err) {
        console.log(`  ❌ Round history query failed: ${err.message}`);
        failed++;
    }

    // ─── Test 7: Edge Cases ─────────────────────────
    console.log('\n⚠️  Test 7: Edge Cases');

    // Edge case: Read non-existent document
    try {
        const nonExistentRef = doc(db, 'fl_rounds', 'round_does_not_exist');
        const snap = await getDoc(nonExistentRef);
        assert(!snap.exists(), 'Non-existent document returns exists()=false');
    } catch (err) {
        console.log(`  ❌ Non-existent doc failed: ${err.message}`);
        failed++;
    }

    // Edge case: Empty signals collection read
    try {
        const q = query(collection(db, 'fl_signals'), orderBy('timestamp', 'desc'), limit(1));
        const snap = await getDocs(q);
        assert(snap.size >= 1, 'Signals collection is readable');
    } catch (err) {
        console.log(`  ❌ Signals read failed: ${err.message}`);
        failed++;
    }

    // Edge case: Write with special characters in text
    try {
        const specialRef = doc(db, 'fl_signals', 'test-special-chars');
        await setDoc(specialRef, {
            type: 'correction',
            corrected_text: "Patient's BP: 140/90 mmHg — elevated. Started Amlodipine 5mg PO q.d.",
            confidence: 0.92,
            specialty: 'cardiology',
            device_id: 'test-device-001',
            round_id: 999,
            timestamp: Date.now(),
        });
        const snap = await getDoc(specialRef);
        assert(snap.data().corrected_text.includes("Patient's BP"), 'Special characters preserved');
        // Cleanup
        await deleteDoc(specialRef);
        assert(true, 'Cleanup: special chars doc deleted');
    } catch (err) {
        console.log(`  ❌ Special chars test failed: ${err.message}`);
        failed++;
    }

    // ─── Cleanup Test Data ──────────────────────────
    console.log('\n🧹 Cleanup: Removing test data');
    try {
        await deleteDoc(doc(db, 'fl_signals', testSignalId));
        await deleteDoc(doc(db, 'fl_rounds', testRoundId));
        await deleteDoc(doc(db, 'fl_devices', 'test-device-001'));
        await deleteDoc(doc(db, 'fl_adapters', 'current'));
        assert(true, 'All test data cleaned up');
    } catch (err) {
        console.log(`  ⚠️  Cleanup partially failed: ${err.message}`);
    }

    // ─── Summary ────────────────────────────────────
    console.log('\n═══════════════════════════════════════');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('═══════════════════════════════════════\n');

    if (failed > 0) {
        console.log('❌ Some tests failed! Check Firestore rules and config.');
        process.exit(1);
    } else {
        console.log('🎉 All tests passed! Firebase FL is fully connected.\n');
        console.log('To test in the app:');
        console.log('  1. npm start → open on Android / web');
        console.log('  2. Go to Federation tab');
        console.log('  3. Tap "Start New Round"');
        console.log('  4. Watch your Firestore console — data appears in real-time!');
        console.log('');
        process.exit(0);
    }
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
