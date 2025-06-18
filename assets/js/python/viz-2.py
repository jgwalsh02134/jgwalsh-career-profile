import plotly.express as px
import pandas as pd

# Data extracted from Part I Violent Crimes totals by type and year 
data = {
    'Year': ['2021', '2021', '2021', '2021',
             '2022', '2022', '2022', '2022',
             '2023', '2023', '2023', '2023',
             '2024', '2024', '2024', '2024'],
    'CrimeType': ['Murder', 'Rape', 'Robbery', 'Aggravated Assault',
                  'Murder', 'Rape', 'Robbery', 'Aggravated Assault',
                  'Murder', 'Rape', 'Robbery', 'Aggravated Assault',
                  'Murder', 'Rape', 'Robbery', 'Aggravated Assault'],
    'Incidents': [18, 56, 183, 640,
                  19, 75, 249, 628,
                  20, 62, 251, 611,
                  13, 91, 237, 588]
}
df = pd.DataFrame(data)
df['Total'] = 'Part I Violent Crimes' # Add a root node

fig = px.sunburst(df, path=['Total', 'Year', 'CrimeType'], values='Incidents',
                  color='CrimeType',
                  color_discrete_map={
                      'Murder': 'black',
                      'Rape': 'skyblue',
                      'Robbery': 'goldenrod',
                      'Aggravated Assault': 'firebrick',
                      '(?)':'lightgrey'
                  })

fig.update_layout(
    title_text='<b>Hierarchical Composition of Part I Violent Crimes (2021-2024)</b>',
    font=dict(family="Arial, sans-serif", size=12, color="black"),
    margin = dict(t=50, l=25, r=25, b=25)
)

# To generate the HTML file
fig.write_html("interactive_violent_crime_sunburst.html")
fig.show()