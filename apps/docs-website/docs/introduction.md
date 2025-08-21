---
sidebar_position: 1
---

# What is Loon

### A Data Visualization Software for Live Cell Microscopy
**Loon** is designed to help scientists **analyze** their cell data, **identify** data processing mistakes, and **communicate** their findings.


:::note  
*Loon is designed to visualize cell data **already generated** from other microscopy software (e.g. [LiveCyte](https://www.phasefocus.com/livecyte), [TrackMate](https://imagej.net/plugins/trackmate/)).*

*Loon does not:*
- *Produce cell segmentation outlines itself*
- *Derive metadata (e.g. mass, time, segmentations) from images.*  

*Instead, Loon is designed to **visualize** cell images and metadata as [input](./getting-started-with-loon/index.md).*
*Loon software is a dedicated data visualization tool and does not alter your original microscopy data.*  
:::

## About
How do cancer cells grow, divide, proliferate and die? How do drugs influence these processes? These are difficult questions that many attempt to answer with a combination of time-series microscopy experiments, classification algorithms, and data visualization. 

However, collecting this type of data and applying algorithms to segment and track cells and construct lineages of proliferation is error-prone; and identifying the errors can be challenging since it often requires cross-checking multiple data types. Similarly, analyzing and communicating the results necessitates synthesizing different data types into a single narrative. State-of-the-art visualization methods for such data use independent line charts, tree diagrams, and images in separate views. 

However, this spatial separation requires the viewer of these charts to combine the relevant pieces of data in memory. To simplify this challenging task, we describe design principles for weaving cell images, time-series data, and tree data into a cohesive visualization. Our design principles are based on choosing a primary data type that drives the layout and integrates the other data types into that layout.

---
### Authors

- **[Devin Lange, Ph.D.](https://www.devinlange.com/)**  &nbsp;-&nbsp;  _Department of Biomedical Informatics, Harvard Medical School_
- **[Alexander Lex, Ph.D.](https://vdl.sci.utah.edu/team/lex/)**  &nbsp;-&nbsp;  _Institute of Human-Centered Computing, Graz University of Technology_
- **[Thomas Zangle, Ph.D.](https://zanglelab.che.utah.edu/)**  &nbsp;-&nbsp;  _Department of Chemical Engineering, University of Utah_
- **[Robert Judson-Torres, Ph.D.](https://www.judsontorreslab.org/)**  &nbsp;-&nbsp;  _Huntsman Cancer Institute, University of Utah_
- **[Edward Polanco, Ph.D.](https://www.linkedin.com/in/eddiethebiochemicalengineer/es?trk=people-guest_people_search-card)**  &nbsp;-&nbsp;  _Department of Chemical Engineering, University of Utah_


### Developers

#### Active
- **[Devin Lange, Ph.D.](https://www.devinlange.com/)**  &nbsp;-&nbsp;  _Department of Biomedical Informatics, Harvard Medical School_
- **[Luke Schreiber](https://www.linkedin.com/in/luke-schreiber-11ab671b7/)**  &nbsp;-&nbsp;  _Scientific Computing and Imaging Institute, University of Utah_
#### Former
- **[Brian Bollen, Ph.D.](https://www.briancbollen.com/about)**  &nbsp;-&nbsp;  _Scientific Computing and Imaging Institute, University of Utah_
- **[Jack Wilburn](https://vdl.sci.utah.edu/team/wilburn/)**  &nbsp;-&nbsp;  _Scientific Computing and Imaging Institute, University of Utah_

### Collaborators

- **[Zangle Lab](https://zanglelab.che.utah.edu/)**  &nbsp;-&nbsp;  _Department of Chemical Engineering, University of Utah_
- **[Judsen-Torres Lab](https://www.judsontorreslab.org/)**  &nbsp;-&nbsp;  _Huntsman Cancer Institute, University of Utah_
- **[Visualization Design Lab](https://www.visdesignlab.net/)**  &nbsp;-&nbsp;  _Scientific Computing and Imaging Institute, University of Utah_