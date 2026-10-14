import json, unittest, subprocess, sys
from pathlib import Path
import joblib, pandas as pd
ROOT=Path(__file__).resolve().parents[1]
class ModelContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.bundle=joblib.load(ROOT/'artifacts/cardia_models.joblib')
        cls.audit=json.loads((ROOT/'artifacts/data_audit.json').read_text())
        cls.schema=json.loads((ROOT/'artifacts/ui_schema.json').read_text())
        cls.df=pd.read_csv(ROOT/'data/source.csv')
    def test_no_target_leakage_and_audited_schema(self):
        features=self.bundle['features']
        self.assertEqual(set(features),set(self.schema_feature_names()))
        self.assertTrue({'Cath','LAD','LCX','RCA'}.isdisjoint(features))
        self.assertEqual(len(features),54)
        self.assertEqual(self.audit['n_rows'],303)
        self.assertEqual(self.audit['duplicate_rows'],0)
        self.assertEqual(sum(self.audit['missing_by_column'].values()),0)
    def schema_feature_names(self): return [x['name'] for x in self.schema['fields']]
    def test_reload_reproduces_bundle_predictions(self):
        x=self.df[self.bundle['features']].iloc[[3]]
        restored=joblib.load(ROOT/'artifacts/cardia_models.joblib')
        for task, model in restored['models'].items():
            p1=self.bundle['models'][task].predict_proba(x)[:,1]
            p2=model.predict_proba(x)[:,1]
            self.assertAlmostEqual(float(p1[0]),float(p2[0]),places=12)
    def test_four_models_and_saved_metadata(self):
        self.assertEqual(set(self.bundle['models']),{'CAD','LAD','LCX','RCA'})
        self.assertEqual(set(self.bundle['model_names']),{'CAD','LAD','LCX','RCA'})
        self.assertEqual(self.bundle['threshold'],0.5)
    def test_synthetic_demo_is_featurewise_median_mode(self):
        from app.cardia_atlas__app__main import example
        result=example()
        self.assertIn('feature-wise medians',result['label'])
        self.assertIn('at modes',result['label'])
        for field in self.schema['fields']:
            name=field['name']
            if field['type']=='number':
                self.assertAlmostEqual(float(result['values'][name]),float(self.df[name].median()))
            elif field['type']=='coded_select':
                self.assertAlmostEqual(float(result['values'][name]),float(self.df[name].mode(dropna=True).iloc[0]))
            else:
                self.assertEqual(result['values'][name],str(self.df[name].mode(dropna=True).iloc[0]))
    def test_explanation_matches_positive_probability_and_top_ten_display_contract(self):
        from app.cardia_atlas__app__main import example, predict, explain, PredictRequest
        result=predict(PredictRequest(values=example()['values'], include_explanations=False))
        self.assertEqual(set(result['predictions']),{'CAD','LAD','LCX','RCA'})
        self.assertEqual(result['explanations'],{})
        names=set(self.bundle['features'])
        for target in result['predictions']:
            prediction=result['predictions'][target]['probability']
            exp=explain(target, PredictRequest(values=example()['values']))
            self.assertEqual(exp['output_scale'],'positive-class predicted probability')
            self.assertAlmostEqual(exp['prediction_probability'],prediction,places=12)
            self.assertLess(exp['additivity_error'],1e-12)
            self.assertEqual(len(exp['contributions']),10)
            self.assertTrue({item['feature'] for item in exp['contributions']}.issubset(names))
        note=(ROOT/'app/static/index.html').read_text()
        self.assertIn('Showing the 10 largest absolute contributions of 54 predictors',note)
        self.assertIn('Additivity uses the full feature contribution set',note)

    def test_input_validation_blank_and_rejects_invalid_values(self):
        from app.cardia_atlas__app__main import validate_values, HTTPException
        self.assertEqual(len(validate_values({}).columns),54)
        cases=[{'Age':float('nan')},{'Age':float('inf')},{'Age':-1},{'unknown_predictor':1}]
        select=next(f for f in self.schema['fields'] if f['type']=='select')
        cases.append({select['name']:'not-a-source-category'})
        for values in cases:
            with self.subTest(values=values), self.assertRaises(HTTPException) as raised:
                validate_values(values)
            self.assertEqual(raised.exception.status_code,422)

    def test_missing_model_bundle_returns_readable_service_error(self):
        code = """import joblib\nfrom fastapi import HTTPException\ndef missing(*args, **kwargs): raise FileNotFoundError('missing model bundle')\njoblib.load=missing\nimport app.main as api\ntry: api.health()\nexcept HTTPException as e:\n print(e.status_code, e.detail)\n"""
        result=subprocess.check_output([sys.executable,'-c',code],cwd=ROOT,text=True)
        self.assertIn('503',result)
        self.assertIn('required model or schema artifact is unavailable or invalid',result)
    def test_frontend_assets_revalidate_after_deployment(self):
        import asyncio
        from types import SimpleNamespace
        from fastapi.responses import Response
        from app.cardia_atlas__app__main import revalidate_frontend_assets
        async def call_next(request): return Response()
        for path in ['/', '/cardia_atlas__app_static__app.js', '/risk_bands.mjs', '/style.css']:
            request=SimpleNamespace(url=SimpleNamespace(path=path))
            response=asyncio.run(revalidate_frontend_assets(request,call_next))
            self.assertEqual(response.headers.get('cache-control'),'no-cache',path)
        request=SimpleNamespace(url=SimpleNamespace(path='/api/health'))
        response=asyncio.run(revalidate_frontend_assets(request,call_next))
        self.assertIsNone(response.headers.get('cache-control'))
if __name__=='__main__': unittest.main()
