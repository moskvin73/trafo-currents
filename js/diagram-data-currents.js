const currentsConfig = {
    "settings": {
        "width": 400, "height": 400, "cx": 200, "cy": 200,
        "gridCircleRadius": 120, "lvLength": 90, "hvLength": 130
    },
    "phases": {
        "A": {
            "vectors": [
                { "angle": 0,    "color": "#d32f2f", "label": "$\\dot{I}_{A2}$", "isLV": true },
                { "angle": 30,   "color": "#d32f2f", "label": "$\\dot{I}_{A1}$", "isLV": false },
                { "angle": -150, "color": "#388e3c", "label": "$\\dot{I}_{B1}$", "isLV": false }
            ]
        },
        "B": {
            "vectors": [
                { "angle": -120, "color": "#388e3c", "label": "$\\dot{I}_{B2}$", "isLV": true },
                { "angle": -90,  "color": "#388e3c", "label": "$\\dot{I}_{B1}$", "isLV": false },
                { "angle": 90,   "color": "#1976d2", "label": "$\\dot{I}_{C1}$", "isLV": false }
            ]
        },
        "C": {
            "vectors": [
                { "angle": 120,  "color": "#1976d2", "label": "$\\dot{I}_{C2}$", "isLV": true },
                { "angle": -30,  "color": "#d32f2f", "label": "$\\dot{I}_{A1}$", "isLV": false },
                { "angle": 150,  "color": "#1976d2", "label": "$\\dot{I}_{C1}$", "isLV": false }
            ]
        }
    }
};
