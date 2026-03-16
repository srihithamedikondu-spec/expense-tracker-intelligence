import joblib
from . import models

model = joblib.load("model.pkl")
vectorizer = joblib.load("vectorizer.pkl")

def predict_category(title, db):

    correction = db.query(models.Correction).filter(
        models.Correction.title.ilike(f"%{title}%")
    ).first()

    if correction:
        return correction.category

    X = vectorizer.transform([title.lower()])
    return model.predict(X)[0]